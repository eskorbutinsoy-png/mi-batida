import { useState } from 'react';

export default function DemoPage() {
  const [activeSection, setActiveSection] = useState<string>('registro');

  const sections = [
    { id: 'registro', nombre: '📝 Registro de Capturas', color: 'from-blue-600 to-blue-500' },
    { id: 'chat', nombre: '💬 Chat', color: 'from-green-600 to-green-500' },
    { id: 'mapa', nombre: '🗺️ Mapa', color: 'from-purple-600 to-purple-500' },
    { id: 'perfil', nombre: '👤 Perfil', color: 'from-pink-600 to-pink-500' },
    { id: 'batida', nombre: 'ℹ️ Info Batida', color: 'from-orange-600 to-orange-500' },
  ];

  return (
    <div className="min-h-screen bg-forest text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber to-amber-light text-forest-dark sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <h1 className="text-2xl font-black">🎨 Mi Batida - Diseño Modernizado</h1>
          <span className="ml-auto text-sm font-bold">v100% UI/UX</span>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <div className="w-64 bg-forest-dark border-r-2 border-amber/30 overflow-y-auto">
          <div className="p-4 space-y-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-4 py-3 rounded-xl font-black text-base transition-all ${
                  activeSection === section.id
                    ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                    : 'text-amber hover:text-amber-light hover:bg-forest/50'
                }`}
              >
                {section.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeSection === 'registro' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-amber to-amber-light text-forest-dark px-6 py-4 rounded-2xl border-2 border-amber">
                <h2 className="text-2xl font-black">ANTES: Registro sin estilos modernos</h2>
                <p className="text-sm mt-2 opacity-90">Inputs simples, sin gradientes, sin bordes destacados, diseño plano</p>
              </div>

              <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/40 rounded-3xl p-8 space-y-6">
                <h2 className="text-white font-black text-2xl">AHORA: Registro Modernizado ✨</h2>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-900/40 to-green-900/10 border-2 border-green-700/60 rounded-2xl p-4 text-center">
                    <p className="text-green-300 text-3xl font-black">12</p>
                    <p className="text-green-400 text-xs font-bold mt-1">Cazados</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-900/40 to-orange-900/10 border-2 border-orange-700/60 rounded-2xl p-4 text-center">
                    <p className="text-orange-300 text-3xl font-black">3</p>
                    <p className="text-orange-400 text-xs font-bold mt-1">Heridos</p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-800/40 to-gray-800/10 border-2 border-gray-700/60 rounded-2xl p-4 text-center">
                    <p className="text-gray-300 text-3xl font-black">2</p>
                    <p className="text-gray-400 text-xs font-bold mt-1">Escapados</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-900/40 to-amber-900/10 border-2 border-amber-700/60 rounded-2xl p-4 text-center">
                    <p className="text-amber-300 text-3xl font-black">17</p>
                    <p className="text-amber-400 text-xs font-bold mt-1">Total</p>
                  </div>
                </div>

                {/* Species Buttons */}
                <div>
                  <p className="text-amber text-xs font-black mb-3">ESPECIES</p>
                  <div className="grid grid-cols-3 gap-3">
                    {['Jabali', 'Conejo', 'Perdiz'].map(sp => (
                      <button key={sp} className="py-3.5 px-4 rounded-2xl border-2 border-amber/50 text-amber hover:border-amber hover:bg-amber/10 font-black transition-all">
                        {sp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Field */}
                <div>
                  <p className="text-amber text-xs font-black mb-2">CANTIDAD</p>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3.5 text-white text-base outline-none focus:border-amber focus:bg-forest-dark/50 transition-all duration-200 font-bold"
                  />
                </div>

                <button className="w-full bg-gradient-to-r from-amber to-amber-light hover:from-amber-light hover:to-amber text-forest-dark font-black py-4 rounded-2xl transition-all duration-200 shadow-lg">
                  ✓ Registrar Captura
                </button>
              </div>
            </div>
          )}

          {activeSection === 'chat' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-green-700/60 rounded-3xl p-8 space-y-4">
                <h2 className="text-white font-black text-2xl">💬 Chat Modernizado</h2>
                
                <div className="space-y-3 h-64 overflow-y-auto">
                  {/* Mensaje del otro */}
                  <div className="flex justify-start">
                    <div className="max-w-xs bg-forest rounded-2xl px-4 py-3 text-sm border-2 border-forest-border">
                      <p className="text-white">He visto un jabali cerca de la postura norte</p>
                      <p className="text-forest-muted text-xs mt-1">14:32</p>
                    </div>
                  </div>

                  {/* Mi mensaje */}
                  <div className="flex justify-end">
                    <div className="max-w-xs bg-gradient-to-r from-amber to-amber-light rounded-2xl px-4 py-3 text-sm text-forest-dark font-bold border-2 border-amber/60">
                      <p>Voy para allá, avísales a los otros</p>
                      <p className="text-forest-dark/70 text-xs mt-1">14:35</p>
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  className="w-full bg-forest-dark border-2 border-forest-border rounded-2xl px-4 py-3 text-white outline-none focus:border-amber transition-all"
                />
              </div>
            </div>
          )}

          {activeSection === 'mapa' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-purple-700/60 rounded-3xl p-8 space-y-6">
                <h2 className="text-white font-black text-2xl">🗺️ Mapa Modernizado</h2>
                
                <div className="bg-forest rounded-2xl h-64 flex items-center justify-center border-2 border-purple-700/40">
                  <p className="text-forest-muted font-bold">Mapa con controles GPS modernizados</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-green-900/40 border-2 border-green-700/60 text-green-300 py-3 rounded-2xl font-black hover:border-green-600">
                    🟢 Rastro
                  </button>
                  <button className="bg-blue-900/40 border-2 border-blue-700/60 text-blue-300 py-3 rounded-2xl font-black hover:border-blue-600">
                    🟦 Puesto
                  </button>
                </div>

                <div className="bg-green-900/20 border-2 border-green-700/40 rounded-2xl px-4 py-3">
                  <p className="text-green-300 font-black text-sm">✓ Posición lista - Ready to hunt</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'perfil' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-pink-700/60 rounded-3xl p-8 space-y-6">
                <h2 className="text-white font-black text-2xl">👤 Perfil Modernizado</h2>
                
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber to-amber-light border-2 border-amber/60 flex items-center justify-center shadow-lg">
                    <span className="text-forest-dark text-5xl font-black">SN</span>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-2xl font-black">Sergio Ibero</p>
                    <p className="text-amber text-xs font-bold mt-1">Miembro desde julio 2024</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-forest to-forest/70 border-2 border-forest-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center">
                      <span className="text-amber font-black">📧</span>
                    </div>
                    <div>
                      <p className="text-amber text-xs font-black">CORREO</p>
                      <p className="text-white font-bold">sergio@batida.com</p>
                    </div>
                  </div>
                </div>

                <button className="w-full border-2 border-red-700/60 text-red-400 hover:text-red-300 py-3.5 rounded-2xl font-black hover:bg-red-900/20 transition-all">
                  🚪 Cerrar sesión
                </button>
              </div>
            </div>
          )}

          {activeSection === 'batida' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-orange-700/60 rounded-3xl p-8 space-y-6">
                <h2 className="text-white font-black text-2xl">ℹ️ Info Batida Modernizada</h2>
                
                <div className="bg-gradient-to-br from-forest to-forest/70 border-2 border-amber/40 rounded-2xl p-5">
                  <h3 className="text-white text-xl font-black mb-3">Batida Soto del Pinar</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-900/40 text-green-300 text-xs px-3 py-1.5 rounded-full border-2 border-green-700/40 font-black">
                      ● Activa ahora
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-forest-dark to-forest-dark/70 border-2 border-amber/30 rounded-2xl p-5">
                  <p className="text-amber text-xs font-black mb-3">🔗 COMPARTIR</p>
                  <div className="flex items-center gap-2 bg-forest border-2 border-forest-border rounded-xl px-4 py-2 mb-3">
                    <span className="text-amber font-black">A7X9K2</span>
                  </div>
                  <button className="w-full bg-green-700/90 hover:bg-green-600 text-white font-black py-3 rounded-2xl transition-all">
                    📱 Compartir por WhatsApp
                  </button>
                </div>

                <div>
                  <p className="text-amber font-black text-base mb-4">👥 PARTICIPANTES (4)</p>
                  <div className="space-y-2.5">
                    {['Sergio Ibero', 'Juan García', 'Carlos Ruiz', 'Miguel Santos'].map((name, i) => (
                      <div key={i} className="bg-gradient-to-r from-forest-dark to-forest-dark/70 border-2 border-forest-border rounded-2xl px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber to-amber-light flex items-center justify-center text-forest-dark font-black">
                          {name[0]}
                        </div>
                        <p className="text-white font-black flex-1">{name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
