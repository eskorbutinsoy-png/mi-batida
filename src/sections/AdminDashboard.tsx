import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, LogOut, Users, Download, Activity, TrendingUp, RefreshCw, Wifi, UserCheck, MapPin, Ban, Trash2, Eye, CheckCircle2 } from 'lucide-react';

interface AppStats {
  appName: string;
  totalUsers: number;
  totalSessions: number;
  totalDownloads: number;
  avgSessionDuration: number;
  lastUpdated: string;
}

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface PlatformStats {
  platform: string;
  uniqueUsers: number;
  totalSessions: number;
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AppStats[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>('Mi Batida');
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conexiones' | 'usuarios' | 'batidas'>('dashboard');
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<any[]>([]);
  const [batidas, setBatidas] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats[]>([]);

  // Verificar si es admin
  useEffect(() => {
    setIsAdmin(user?.email === 'eskorbutinsoy@gmail.com');
  }, [user]);

  // Cargar estadísticas
  useEffect(() => {
    if (!isAdmin) return;
    loadStats();
    loadAllRegisteredUsers();
    loadActiveSessions();
    loadBatidas();
    loadPlatformStats();
  }, [isAdmin]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Obtener estadísticas de Mi Batida
      const [sessions1, users1, downloads1] = await Promise.all([
        supabase
          .from('app_sessions')
          .select('*', { count: 'exact' })
          .eq('app_name', 'Mi Batida'),
        supabase
          .from('auth.users')
          .select('*', { count: 'exact' }),
        supabase
          .from('app_downloads')
          .select('*', { count: 'exact' })
          .eq('app_name', 'Mi Batida'),
      ]);

      // Obtener estadísticas de Mi Registro de Caza
      const [sessions2, downloads2] = await Promise.all([
        supabase
          .from('app_sessions')
          .select('*', { count: 'exact' })
          .eq('app_name', 'Mi Registro de Caza'),
        supabase
          .from('app_downloads')
          .select('*', { count: 'exact' })
          .eq('app_name', 'Mi Registro de Caza'),
      ]);

      const statsData: AppStats[] = [
        {
          appName: 'Mi Batida',
          totalUsers: users1.count || 0,
          totalSessions: sessions1.count || 0,
          totalDownloads: downloads1.count || 0,
          avgSessionDuration: 0,
          lastUpdated: new Date().toLocaleString(),
        },
        {
          appName: 'Mi Registro de Caza',
          totalUsers: users1.count || 0,
          totalSessions: sessions2.count || 0,
          totalDownloads: downloads2.count || 0,
          avgSessionDuration: 0,
          lastUpdated: new Date().toLocaleString(),
        },
      ];

      setStats(statsData);
      await loadAppDetails('Mi Batida');
    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAppDetails = async (appName: string) => {
    try {
      setSelectedApp(appName);

      const [usersData, eventsData] = await Promise.all([
        supabase
          .from('app_sessions')
          .select('user_id, created_at, session_start')
          .eq('app_name', appName)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('app_events')
          .select('*')
          .eq('app_name', appName)
          .order('timestamp', { ascending: false })
          .limit(50),
      ]);

      if (usersData.data) {
        const uniqueUsers = Array.from(
          new Map(
            usersData.data.map((item) => [item.user_id, item])
          ).values()
        ).slice(0, 10);
        setUsers(uniqueUsers as any[]);
      }

      if (eventsData.data) {
        setEvents(eventsData.data);
      }
    } catch (err) {
      console.error('Error loading app details:', err);
    }
  };

  const loadActiveSessions = async () => {
    try {
      // Obtener sesiones de los últimos 30 minutos (activas)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000).toISOString();
      
      const { data, error } = await supabase
        .from('app_sessions')
        .select('user_id, app_name, session_start, platform')
        .gte('session_start', thirtyMinutesAgo)
        .is('session_end', null)
        .order('session_start', { ascending: false });

      if (error) throw error;
      setActiveUsers(data || []);
    } catch (err) {
      console.error('Error loading active sessions:', err);
    }
  };

  const loadAllRegisteredUsers = async () => {
    try {
      console.log('🔍 Cargando usuarios del sistema');
      
      if (!user?.email) {
        console.warn('⚠️ No hay usuario autenticado');
        setAllRegisteredUsers([]);
        return;
      }

      let users: any[] = [];

      // INTENTO 1: Obtener usuarios reales de auth.users via RPC
      try {
        console.log('📡 Intentando obtener usuarios via RPC...');
        const { data: rpcUsers, error: rpcError } = await supabase.rpc('get_all_registered_users');
        
        if (!rpcError && rpcUsers && rpcUsers.length > 0) {
          console.log(`✅ Usuarios obtenidos via RPC: ${rpcUsers.length}`);
          users = rpcUsers.map((u: any) => ({
            id: u.id,
            email: u.email,
            createdAt: u.created_at,
            lastSignIn: u.last_sign_in_at,
            lastActivity: u.last_sign_in_at,
            isBlocked: false,
            metadata: { source: 'auth.users' }
          }));
        } else if (rpcError) {
          console.warn('⚠️ RPC no disponible:', rpcError.message);
        }
      } catch (rpcErr: any) {
        console.warn('⚠️ Error en RPC:', rpcErr.message);
      }

      // INTENTO 2: Si RPC falla, obtener de app_sessions agrupado por usuario
      if (users.length === 0) {
        console.log('📡 Intentando obtener de app_sessions...');
        const { data: sessions, error: sessionError } = await supabase
          .from('app_sessions')
          .select('user_id, session_start, app_name, platform')
          .limit(1000);

        if (sessionError) {
          console.warn('⚠️ app_sessions no disponible:', sessionError.message);
        } else if (sessions && sessions.length > 0) {
          console.log(`✅ Sesiones encontradas: ${sessions.length}`);
          
          // Agrupar por usuario_id para obtener usuarios únicos
          const userMap = new Map<string, any>();
          
          sessions.forEach((session: any) => {
            const userId = session.user_id;
            if (!userMap.has(userId)) {
              userMap.set(userId, {
                id: userId,
                userId: userId,
                lastActivity: session.session_start,
                apps: [session.app_name],
                sessionCount: 1,
                platforms: [session.platform]
              });
            } else {
              const u = userMap.get(userId)!;
              u.sessionCount += 1;
              if (!u.apps.includes(session.app_name)) {
                u.apps.push(session.app_name);
              }
              if (!u.platforms.includes(session.platform)) {
                u.platforms.push(session.platform);
              }
            }
          });

          users = Array.from(userMap.values());
        }
      }

      // FALLBACK: Si no hay datos, mostrar usuario actual
      if (users.length === 0 && user?.email) {
        console.log('📌 Mostrando solo usuario autenticado (admin)');
        users = [{
          id: user.id || 'unknown',
          email: user.email,
          createdAt: new Date().toISOString(),
          lastSignIn: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          isBlocked: false,
          metadata: { note: 'Usuario administrador' }
        }];
      }

      // Agregar información adicional a cada usuario
      const usersWithInfo = users.map(u => {
        let status = 'Inactivo';
        const activityTime = u.lastActivity || u.lastSignIn;
        if (activityTime) {
          const lastActivity = new Date(activityTime);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastActivity.getTime()) / 60000;
          
          if (diffMinutes < 5) {
            status = 'En línea';
          } else if (diffMinutes < 24 * 60) {
            status = 'Activo hoy';
          } else {
            status = 'Inactivo';
          }
        }

        return {
          id: u.id,
          email: u.email || u.userId,
          createdAt: u.createdAt || u.lastSignIn,
          lastSignIn: u.lastSignIn,
          lastActivity: activityTime,
          isBlocked: u.isBlocked || false,
          status: status,
          metadata: u.metadata || {}
        };
      });

      console.log(`✅ Total usuarios a mostrar: ${usersWithInfo.length}`);
      setAllRegisteredUsers(usersWithInfo);
    } catch (err: any) {
      console.error('❌ Error en loadAllRegisteredUsers:', err.message || err);
      // Fallback: mostrar usuario actual
      if (user?.email) {
        setAllRegisteredUsers([{
          id: user.id || 'unknown',
          email: user.email,
          createdAt: new Date().toISOString(),
          lastSignIn: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          isBlocked: false,
          status: 'En línea',
          metadata: {}
        }]);
      } else {
        setAllRegisteredUsers([]);
      }
    }
  };

  const loadRegisteredUsersAlternative = async () => {
    try {
      // Alternativa: obtener usuarios únicos de sesiones
      const { data, error } = await supabase
        .from('app_sessions')
        .select('user_id, session_start')
        .order('session_start', { ascending: false });

      if (error) throw error;

      const uniqueUsers = Array.from(
        new Map(
          (data || []).map((item: any) => [item.user_id, item])
        ).values()
      ) as any[];

      const usersWithInfo = uniqueUsers.map(u => ({
        id: u.user_id,
        createdAt: u.session_start,
        status: 'Activo'
      }));

      setAllRegisteredUsers(usersWithInfo);
    } catch (err) {
      console.error('Error loading registered users (alternative):', err);
    }
  };

  const loadBatidas = async () => {
    try {
      // Intenta obtener batidas/registros de caza
      const { data, error } = await supabase
        .from('batidas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = tabla no existe, esto es esperado
        throw error;
      }

      setBatidas(data || []);
    } catch (err) {
      console.error('Note: batidas table not found or error:', err);
      // Esto es normal si la tabla no existe
      setBatidas([]);
    }
  };

  const loadPlatformStats = async () => {
    try {
      // Obtener sesiones por plataforma
      const { data, error } = await supabase
        .from('app_sessions')
        .select('platform, user_id');

      if (error) throw error;

      // Agrupar por plataforma
      const platformMap = new Map<string, Set<string>>();
      (data || []).forEach((session: any) => {
        const platform = session.platform || 'unknown';
        if (!platformMap.has(platform)) {
          platformMap.set(platform, new Set());
        }
        platformMap.get(platform)!.add(session.user_id);
      });

      // Convertir a array con estadísticas
      const stats: PlatformStats[] = Array.from(platformMap.entries()).map(([platform, userIds]) => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        uniqueUsers: userIds.size,
        totalSessions: (data || []).filter((s: any) => s.platform === platform).length,
      }));

      setPlatformStats(stats);
    } catch (err) {
      console.error('Error loading platform stats:', err);
    }
  };

  const toggleBlockUser = async (userId: string, currentBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('app_registered_users')
        .update({ is_blocked: !currentBlocked })
        .eq('id', userId);

      if (error) throw error;
      
      // Recargar usuarios
      await loadAllRegisteredUsers();
    } catch (err) {
      console.error('Error blocking/unblocking user:', err);
      alert('Error al cambiar estado del usuario');
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar a ${userEmail}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      // Eliminar de app_registered_users (cascada eliminará sesiones y eventos)
      const { error } = await supabase
        .from('app_registered_users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      // Recargar usuarios
      await loadAllRegisteredUsers();
      alert('Usuario eliminado correctamente');
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Error al eliminar usuario');
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-forest">
        <div className="text-center">
          <Lock size={48} className="text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-amber-300 mb-2">Acceso Denegado</h1>
          <p className="text-amber-600">Solo administradores pueden acceder al dashboard</p>
        </div>
      </div>
    );
  }

  const chartData: ChartData[] = stats.map((s) => ({
    name: s.appName,
    usuarios: s.totalUsers,
    sesiones: s.totalSessions,
    descargas: s.totalDownloads,
  }));

  const currentStats = stats.find((s) => s.appName === selectedApp) || stats[0];

  return (
    <div className="bg-forest min-h-screen p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-amber-300">Admin App</h1>
          <p className="text-amber-600 mt-1">Mi Gestión de Caza - Analytics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              loadStats().then(() => setRefreshing(false));
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700/40 hover:bg-amber-700/60 text-amber-300 rounded-lg transition"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-amber-400">Cargando datos...</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-amber-700/30 pb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-t-lg font-bold transition whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-amber-700/60 text-amber-200'
                  : 'text-amber-600 hover:bg-black/30'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('conexiones')}
              className={`px-6 py-2 rounded-t-lg font-bold transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'conexiones'
                  ? 'bg-amber-700/60 text-amber-200'
                  : 'text-amber-600 hover:bg-black/30'
              }`}
            >
              <Wifi size={16} /> Conexiones Activas ({activeUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`px-6 py-2 rounded-t-lg font-bold transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'usuarios'
                  ? 'bg-amber-700/60 text-amber-200'
                  : 'text-amber-600 hover:bg-black/30'
              }`}
            >
              <Users size={16} /> Usuarios ({allRegisteredUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('batidas')}
              className={`px-6 py-2 rounded-t-lg font-bold transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'batidas'
                  ? 'bg-amber-700/60 text-amber-200'
                  : 'text-amber-600 hover:bg-black/30'
              }`}
            >
              <MapPin size={16} /> Batidas ({batidas.length})
            </button>
          </div>

          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-600 text-sm">Total Usuarios</p>
                      <p className="text-2xl font-bold text-amber-300 mt-1">{allRegisteredUsers.length}</p>
                    </div>
                    <Users size={32} className="text-amber-600 opacity-50" />
                  </div>
                </div>

                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-600 text-sm">Usuarios Activos</p>
                      <p className="text-2xl font-bold text-green-400 mt-1">{activeUsers.length}</p>
                    </div>
                    <Wifi size={32} className="text-green-600 opacity-50" />
                  </div>
                </div>

                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-600 text-sm">Total Sesiones</p>
                      <p className="text-2xl font-bold text-amber-300 mt-1">{currentStats.totalSessions}</p>
                    </div>
                    <Activity size={32} className="text-amber-600 opacity-50" />
                  </div>
                </div>

                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-600 text-sm">Descargas APK</p>
                      <p className="text-2xl font-bold text-amber-300 mt-1">{currentStats.totalDownloads}</p>
                    </div>
                    <Download size={32} className="text-amber-600 opacity-50" />
                  </div>
                </div>
              </div>

              {/* Plataform Stats KPIs */}
              {platformStats.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-amber-300 font-bold mb-4">Usuarios por Plataforma</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {platformStats.map((ps, idx) => (
                      <div key={idx} className="bg-black/40 border border-blue-700/20 rounded-xl p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-blue-600 text-sm">{ps.platform}</p>
                            <p className="text-2xl font-bold text-blue-300 mt-1">{ps.uniqueUsers}</p>
                            <p className="text-xs text-blue-500 mt-2">{ps.totalSessions} sesiones</p>
                          </div>
                          <div className="text-4xl text-blue-600 opacity-30">
                            {ps.platform === 'Web' ? '🌐' : '📱'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selector de App */}
              <div className="bg-black/40 border border-amber-700/20 rounded-xl p-4 mb-8">
                <p className="text-amber-600 text-sm mb-3">Selecciona una app para ver detalles:</p>
                <div className="flex gap-3">
                  {stats.map((s) => (
                    <button
                      key={s.appName}
                      onClick={() => loadAppDetails(s.appName)}
                      className={`px-6 py-2 rounded-lg font-medium transition ${
                        selectedApp === s.appName
                          ? 'bg-amber-700/60 text-amber-200'
                          : 'bg-black/30 text-amber-600 hover:bg-black/50'
                      }`}
                    >
                      {s.appName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Gráfico de Barras - Comparativa */}
                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <h3 className="text-amber-300 font-bold mb-4">Comparativa de Apps</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#744200" />
                      <XAxis dataKey="name" stroke="#b45309" />
                      <YAxis stroke="#b45309" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #b45309',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="sesiones" fill="#fbbf24" />
                      <Bar dataKey="descargas" fill="#d97706" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfico Plataforma - Web vs Android */}
                {platformStats.length > 0 && (
                  <div className="bg-black/40 border border-blue-700/20 rounded-xl p-6">
                    <h3 className="text-blue-300 font-bold mb-4">Usuarios por Plataforma</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={platformStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                        <XAxis dataKey="platform" stroke="#3b82f6" />
                        <YAxis stroke="#3b82f6" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #3b82f6',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="uniqueUsers" fill="#60a5fa" name="Usuarios Únicos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Gráfico Circular */}
                <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
                  <h3 className="text-amber-300 font-bold mb-4">Distribución de Sesiones</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="sesiones"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        <Cell fill="#fbbf24" />
                        <Cell fill="#d97706" />
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #b45309',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {/* CONEXIONES ACTIVAS TAB */}
          {activeTab === 'conexiones' && (
            <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
              <h3 className="text-amber-300 font-bold mb-4">Usuarios Conectados Ahora</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-700/20">
                      <th className="text-left py-2 text-amber-600">User ID</th>
                      <th className="text-left py-2 text-amber-600">App</th>
                      <th className="text-left py-2 text-amber-600">Plataforma</th>
                      <th className="text-left py-2 text-amber-600">Conectado desde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-amber-600">
                          No hay usuarios conectados en este momento
                        </td>
                      </tr>
                    ) : (
                      activeUsers.map((u, i) => (
                        <tr key={i} className="border-b border-amber-700/10 hover:bg-black/30">
                          <td className="py-2 text-amber-300 font-mono text-xs">
                            {u.user_id?.substring(0, 12)}...
                          </td>
                          <td className="py-2 text-amber-500 text-xs">{u.app_name}</td>
                          <td className="py-2">
                            <span className="text-green-400 font-medium text-xs bg-green-900/30 px-2 py-1 rounded">
                              {u.platform || 'mobile'}
                            </span>
                          </td>
                          <td className="py-2 text-amber-500 text-xs">
                            {new Date(u.session_start).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* USUARIOS REGISTRADOS TAB */}
          {activeTab === 'usuarios' && (
            <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
              <h3 className="text-amber-300 font-bold mb-4">Usuarios Registrados ({allRegisteredUsers.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-700/20">
                      <th className="text-left py-2 text-amber-600">Email</th>
                      <th className="text-left py-2 text-amber-600">Registrado</th>
                      <th className="text-left py-2 text-amber-600">Última Actividad</th>
                      <th className="text-left py-2 text-amber-600">Sesiones</th>
                      <th className="text-left py-2 text-amber-600">Estado</th>
                      <th className="text-left py-2 text-amber-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRegisteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-amber-600">
                          Cargando usuarios registrados...
                        </td>
                      </tr>
                    ) : (
                      allRegisteredUsers.map((u, i) => (
                        <tr key={i} className="border-b border-amber-700/10 hover:bg-black/30 transition">
                          <td className="py-3 text-amber-300 text-sm font-medium">{u.email}</td>
                          <td className="py-3 text-amber-500 text-xs">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3 text-amber-500 text-xs">
                            {u.lastActivity ? new Date(u.lastActivity).toLocaleString() : 'Nunca'}
                          </td>
                          <td className="py-3 text-amber-400 text-sm font-medium">
                            {/* Aquí iría el count de sesiones */}
                            -
                          </td>
                          <td className="py-3">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                              u.isBlocked 
                                ? 'bg-red-900/40 text-red-300' 
                                : u.status === 'En línea'
                                ? 'bg-green-900/40 text-green-300'
                                : u.status === 'Activo hoy'
                                ? 'bg-blue-900/40 text-blue-300'
                                : 'bg-amber-900/40 text-amber-300'
                            }`}>
                              {u.isBlocked ? '🔒 Bloqueado' : u.status}
                            </span>
                          </td>
                          <td className="py-3 flex gap-2">
                            <button
                              onClick={() => toggleBlockUser(u.id, u.isBlocked)}
                              className={`text-xs px-2 py-1 rounded transition ${
                                u.isBlocked
                                  ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                                  : 'bg-red-900/40 text-red-400 hover:bg-red-900/60'
                              }`}
                              title={u.isBlocked ? 'Desbloquear usuario' : 'Bloquear usuario'}
                            >
                              {u.isBlocked ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id, u.email)}
                              className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40 transition"
                              title="Eliminar usuario"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-xs text-amber-600 bg-black/50 p-3 rounded border border-amber-700/10">
                <p>💡 En línea: Activo en los últimos 5 minutos | Activo hoy: Últimas 24h | Inactivo: Más de 24h sin actividad</p>
              </div>
            </div>
          )}

          {/* BATIDAS TAB */}
          {activeTab === 'batidas' && (
            <div className="bg-black/40 border border-amber-700/20 rounded-xl p-6">
              <h3 className="text-amber-300 font-bold mb-4">Nuevas Batidas/Cacerías</h3>
              {batidas.length === 0 ? (
                <p className="text-amber-600 text-center py-8">No hay registros de batidas aún</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-700/20">
                        <th className="text-left py-2 text-amber-600">Usuario</th>
                        <th className="text-left py-2 text-amber-600">Nombre</th>
                        <th className="text-left py-2 text-amber-600">Ubicación</th>
                        <th className="text-left py-2 text-amber-600">Fecha</th>
                        <th className="text-left py-2 text-amber-600">Detalles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batidas.slice(0, 20).map((b, i) => (
                        <tr key={i} className="border-b border-amber-700/10 hover:bg-black/30">
                          <td className="py-2 text-amber-300 font-mono text-xs">
                            {b.user_id?.substring(0, 8)}...
                          </td>
                          <td className="py-2 text-amber-300 text-xs">{b.nombre || b.name || 'Sin nombre'}</td>
                          <td className="py-2 text-amber-500 text-xs">{b.location || 'N/A'}</td>
                          <td className="py-2 text-amber-500 text-xs">
                            {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-2 text-amber-600 text-xs max-w-xs truncate">
                            {b.descripcion || b.description || 'Sin descripción'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
