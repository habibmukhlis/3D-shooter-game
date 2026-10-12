import React, { useState } from 'react';
import { X, Sliders, Volume2, Monitor, Crosshair, RotateCcw, Check } from 'lucide-react';
import { DEFAULT_SETTINGS, GameSettings } from '../types/game';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
}

type TabType = 'gameplay' | 'graphics' | 'audio' | 'controls';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('gameplay');
  const [current, setCurrent] = useState<GameSettings>({ ...settings });

  if (!isOpen) return null;

  const handleChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    const updated = { ...current, [key]: value };
    setCurrent(updated);
    onUpdateSettings(updated);
  };

  const handleReset = () => {
    setCurrent({ ...DEFAULT_SETTINGS });
    onUpdateSettings({ ...DEFAULT_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none font-mono text-emerald-400">
      <div className="relative w-full max-w-2xl bg-stone-950 border-2 border-emerald-600/80 rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950/70 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold tracking-widest text-emerald-300">
              OPERATIONAL CONFIGURATION // SETTINGS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-emerald-900/60 text-emerald-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-emerald-900/80 bg-black/60 px-6 pt-2 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('gameplay')}
            className={`px-4 py-2 border-b-2 font-bold cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'gameplay'
                ? 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-emerald-700 hover:text-emerald-400'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" /> GAMEPLAY
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2 border-b-2 font-bold cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'controls'
                ? 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-emerald-700 hover:text-emerald-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> CONTROLS
          </button>
          <button
            onClick={() => setActiveTab('graphics')}
            className={`px-4 py-2 border-b-2 font-bold cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'graphics'
                ? 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-emerald-700 hover:text-emerald-400'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> GRAPHICS & FOV
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-4 py-2 border-b-2 font-bold cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-emerald-700 hover:text-emerald-400'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> AUDIO
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* 1. GAMEPLAY TAB */}
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              {/* Crosshair Style */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">RETICLE CROSSHAIR STYLE</div>
                  <div className="text-[10px] text-emerald-600">HUD dynamic targeting reticle presentation</div>
                </div>
                <div className="flex gap-2">
                  {(['classic', 'dot', 'circle'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => handleChange('crosshairStyle', style)}
                      className={`px-3 py-1 rounded border text-xs capitalize cursor-pointer transition ${
                        current.crosshairStyle === style
                          ? 'bg-emerald-800 border-emerald-400 text-white font-bold'
                          : 'bg-black/50 border-emerald-950 text-emerald-600 hover:text-emerald-300'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Head Bobbing */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">CAMERA HEAD BOBBING</div>
                  <div className="text-[10px] text-emerald-600">Natural camera swaying motion while walking and sprinting</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.headBobbing}
                    onChange={(e) => handleChange('headBobbing', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-emerald-950 border border-emerald-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Bob Intensity Slider */}
              {current.headBobbing && (
                <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-bold text-emerald-300">HEAD BOB INTENSITY</span>
                    <span className="text-emerald-400">{Math.round(current.bobIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.1"
                    value={current.bobIntensity}
                    onChange={(e) => handleChange('bobIntensity', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Damage Indicators */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">DIRECTIONAL HIT INDICATORS</div>
                  <div className="text-[10px] text-emerald-600">Display directional red threat arcs when sustaining enemy gunfire</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.showDamageIndicators}
                    onChange={(e) => handleChange('showDamageIndicators', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-emerald-950 border border-emerald-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* 2. CONTROLS TAB */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {/* Mouse Sensitivity */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-300">LOOK SENSITIVITY</span>
                  <span className="text-emerald-400">{current.mouseSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.05"
                  value={current.mouseSensitivity}
                  onChange={(e) => handleChange('mouseSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Invert Mouse Y */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">INVERT PITCH (Y-AXIS)</div>
                  <div className="text-[10px] text-emerald-600">Invert vertical mouse aiming input</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.invertY}
                    onChange={(e) => handleChange('invertY', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-emerald-950 border border-emerald-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Key Bindings Quick Reference Card */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="font-bold text-emerald-300 border-b border-emerald-950 pb-1">KEYBOARD SHORTCUTS</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-500">
                  <div><strong className="text-emerald-300">W, A, S, D:</strong> Tactical Movement</div>
                  <div><strong className="text-emerald-300">Left-Shift:</strong> Sprint (Audible)</div>
                  <div><strong className="text-emerald-300">C / Ctrl:</strong> Crouch (Stealth)</div>
                  <div><strong className="text-emerald-300">Space:</strong> Jump</div>
                  <div><strong className="text-emerald-300">Q / E:</strong> Lean Left / Right</div>
                  <div><strong className="text-emerald-300">N:</strong> Night Vision Goggles</div>
                  <div><strong className="text-emerald-300">B:</strong> Tactical Binoculars</div>
                  <div><strong className="text-emerald-300">Tab / M:</strong> Satellite PDA Map</div>
                  <div><strong className="text-emerald-300">1 - 4:</strong> Weapon Selection</div>
                  <div><strong className="text-emerald-300">ESC:</strong> Pause & Settings</div>
                </div>
              </div>
            </div>
          )}

          {/* 3. GRAPHICS TAB */}
          {activeTab === 'graphics' && (
            <div className="space-y-4">
              {/* FOV Slider */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-300">FIELD OF VIEW (FOV)</span>
                  <span className="text-emerald-400">{current.fieldOfView}°</span>
                </div>
                <input
                  type="range"
                  min="65"
                  max="105"
                  step="1"
                  value={current.fieldOfView}
                  onChange={(e) => handleChange('fieldOfView', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Shadows Quality */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">DYNAMIC SHADOWS QUALITY</div>
                  <div className="text-[10px] text-emerald-600">Real-time moonlight and spotlight shadow maps</div>
                </div>
                <div className="flex gap-2">
                  {(['off', 'low', 'high'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleChange('shadowQuality', q)}
                      className={`px-3 py-1 rounded border text-xs uppercase cursor-pointer transition ${
                        current.shadowQuality === q
                          ? 'bg-emerald-800 border-emerald-400 text-white font-bold'
                          : 'bg-black/50 border-emerald-950 text-emerald-600 hover:text-emerald-300'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Post-Processing */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-300">TACTICAL SCANLINES & ATMOSPHERE</div>
                  <div className="text-[10px] text-emerald-600">Cold War CRT filter and military fog rendering</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.postProcessing}
                    onChange={(e) => handleChange('postProcessing', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-emerald-950 border border-emerald-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* 4. AUDIO TAB */}
          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Master Volume */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-300">MASTER AUDIO VOLUME</span>
                  <span className="text-emerald-400">{current.masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={current.masterVolume}
                  onChange={(e) => handleChange('masterVolume', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* SFX Volume */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-300">BALLISTICS & COMBAT SFX</span>
                  <span className="text-emerald-400">{current.sfxVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={current.sfxVolume}
                  onChange={(e) => handleChange('sfxVolume', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Ambient Volume */}
              <div className="bg-black/60 p-4 rounded border border-emerald-900/60 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-emerald-300">ENVIRONMENT & SIREN AMBIENCE</span>
                  <span className="text-emerald-400">{current.ambientVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={current.ambientVolume}
                  onChange={(e) => handleChange('ambientVolume', parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-emerald-950/40 border-t border-emerald-900/80 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-black/60 hover:bg-emerald-950 border border-emerald-900 text-emerald-500 hover:text-emerald-300 text-xs rounded transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET DEFAULTS</span>
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-black font-bold tracking-wider text-xs uppercase rounded transition cursor-pointer flex items-center gap-2 shadow-lg"
          >
            <Check className="w-4 h-4" />
            <span>APPLY & RESUME</span>
          </button>
        </div>
      </div>
    </div>
  );
};
