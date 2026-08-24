'use client';

import React, { useState, useEffect } from 'react';
import { UserService, GroupService } from '@/lib/services/storage-service';
import { UserProfile, UserPosition, DominantFoot } from '@/types';
import { maskPhone, maskCEP } from '@/lib/utils/masks';
import { fetchAddressByCEP, parseAddressString } from '@/lib/utils/cep-service';
import { showToast } from '@/components/ui/Toast';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { 
  User, 
  ShieldCheck, 
  Phone, 
  MapPin, 
  Mail, 
  CheckCircle2, 
  Save, 
  Activity, 
  Trophy,
  Sparkles,
  ArrowLeft,
  Smile
} from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    avatarUrl: '',
    email: '',
    phone: '',
    cpf: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    address: '',
    mainPosition: 'meia' as UserPosition,
    secondaryPosition: '' as UserPosition | '',
    dominantFoot: 'destro' as DominantFoot,
    heightCm: '',
    weightKg: '',
  });

  useEffect(() => {
    const current = UserService.getCurrentUser();
    setUser(current);
    const parsedAddr = parseAddressString(current.address);

    setFormData({
      name: current.name || '',
      nickname: current.nickname || '',
      avatarUrl: current.avatarUrl || '',
      email: current.email || '',
      phone: current.phone || '',
      cpf: current.cpf || '',
      cep: current.cep || parsedAddr.cep || '',
      street: current.street || parsedAddr.street || '',
      number: current.number || parsedAddr.number || '',
      neighborhood: current.neighborhood || parsedAddr.neighborhood || '',
      city: current.city || parsedAddr.city || '',
      state: current.state || parsedAddr.state || '',
      address: current.address || '',
      mainPosition: current.mainPosition || 'meia',
      secondaryPosition: current.secondaryPosition || '',
      dominantFoot: current.dominantFoot || 'destro',
      heightCm: current.heightCm ? String(current.heightCm) : '',
      weightKg: current.weightKg ? String(current.weightKg) : '',
    });
  }, []);

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = maskCEP(raw);
    
    setFormData((prev) => ({ ...prev, cep: formatted }));

    const clean = raw.replace(/\D/g, '');
    if (clean.length === 8) {
      setCepLoading(true);
      const res = await fetchAddressByCEP(clean);
      setCepLoading(false);

      if (res) {
        setFormData((prev) => {
          const street = res.logradouro || '';
          const neighborhood = res.bairro || '';
          const city = res.localidade || '';
          const state = res.uf || '';
          const fullAddress = `${street}${prev.number ? `, ${prev.number}` : ''}, ${neighborhood}, ${city} - ${state} (CEP: ${formatted})`;

          return {
            ...prev,
            street,
            neighborhood,
            city,
            state,
            address: fullAddress,
          };
        });
      }
    }
  };

  const handleAddressFieldChange = (field: 'street' | 'number' | 'neighborhood' | 'city' | 'state', value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const full = `${updated.street || ''}${updated.number ? `, ${updated.number}` : ''}, ${updated.neighborhood || ''}, ${updated.city || ''} - ${updated.state || ''}${updated.cep ? ` (CEP: ${updated.cep})` : ''}`.replace(/^,\s*/, '');
      return { ...updated, address: full };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'phone') formattedValue = maskPhone(value);

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);

    try {
      const updated = await UserService.updateUserProfile(user?.id || '', {
        name: formData.name,
        nickname: formData.nickname.trim() || undefined,
        avatarUrl: formData.avatarUrl || undefined,
        email: formData.email,
        phone: formData.phone,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        address: formData.address,
        mainPosition: formData.mainPosition,
        secondaryPosition: formData.secondaryPosition || undefined,
        dominantFoot: formData.dominantFoot,
        heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
        weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
      });

      setUser(updated);
      setFormData((prev) => ({
        ...prev,
        cep: updated.cep || prev.cep,
        street: updated.street || prev.street,
        number: updated.number || prev.number,
        neighborhood: updated.neighborhood || prev.neighborhood,
        city: updated.city || prev.city,
        state: updated.state || prev.state,
        address: updated.address || prev.address,
        mainPosition: updated.mainPosition,
        secondaryPosition: updated.secondaryPosition || '',
        dominantFoot: updated.dominantFoot || 'destro',
      }));
      setSavedSuccess(true);
      showToast('Perfil, endereço e características salvos com sucesso! ✅', 'success');
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar perfil. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const userGroups = GroupService.getUserGroups();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-400" /> Meu Perfil de Atleta
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Suas informações atléticas usadas no sorteio de times e nos grupos de pelada.
          </p>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            Perfil e endereço atualizados com sucesso!
          </div>
        )}
      </div>

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card do Cartão de Atleta */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
            
            {/* Foto de Perfil com upload direto */}
            <div className="mb-4">
              <AvatarUpload
                currentAvatarUrl={formData.avatarUrl}
                onAvatarChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                label="Foto do Atleta"
                size="lg"
              />
            </div>

            <h2 className="text-lg font-black text-white">{formData.name || 'Atleta'}</h2>
            {formData.nickname && (
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] border border-emerald-500/30">
                "{formData.nickname}"
              </span>
            )}
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mt-1.5">
              {formData.mainPosition}
            </p>

            <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-left text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Perna</span>
                <span className="font-bold text-white capitalize">{formData.dominantFoot}</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 font-bold block uppercase">Nota Sorteio</span>
                <span className="font-bold text-amber-400">⭐ {user?.overallRating?.toFixed(1) || '6.5'}</span>
              </div>
            </div>

            {/* Meus Grupos */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 text-left">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-2">
                Meus Grupos ({userGroups.length})
              </span>
              {userGroups.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">Nenhum grupo ativo.</p>
              ) : (
                <div className="space-y-1.5">
                  {userGroups.map((ug) => (
                    <div key={ug.group.id} className="text-xs bg-slate-950 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between">
                      <span className="font-bold text-white truncate max-w-[120px]">{ug.group.name}</span>
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">{ug.member.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formulário de Edição */}
        <form onSubmit={handleSave} className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Editar Informações
          </h3>

          {/* Dados Pessoais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Nome Completo</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Apelido no Baba</label>
              <div className="relative">
                <Smile className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="Ex: Canhotinha, Romário..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">CPF (Validado)</label>
              <input
                type="text"
                value={formData.cpf}
                disabled
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">E-mail</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">WhatsApp / Telefone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Endereço com busca automática por CEP */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Endereço Residencial (Busca Automática por CEP)
              </label>
              {cepLoading && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-spin" /> Buscando CEP...
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-1">
                <input
                  type="text"
                  name="cep"
                  maxLength={9}
                  value={formData.cep}
                  onChange={handleCepChange}
                  placeholder="CEP 00000-000"
                  className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-400 font-bold"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => handleAddressFieldChange('street', e.target.value)}
                  placeholder="Rua / Logradouro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-1">
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => handleAddressFieldChange('number', e.target.value)}
                  placeholder="Número"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.neighborhood}
                  onChange={(e) => handleAddressFieldChange('neighborhood', e.target.value)}
                  placeholder="Bairro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleAddressFieldChange('city', e.target.value)}
                  placeholder="Cidade"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="col-span-1">
                <input
                  type="text"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => handleAddressFieldChange('state', e.target.value.toUpperCase())}
                  placeholder="UF"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase placeholder-slate-600 focus:outline-none focus:border-emerald-500 text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* Dados Físicos & Táticos */}
          <div className="pt-4 border-t border-slate-800/80">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Características do Atleta
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Posição Principal</label>
                <select
                  name="mainPosition"
                  value={formData.mainPosition}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="goleiro">🧤 Goleiro</option>
                  <option value="zagueiro">🛡️ Zagueiro</option>
                  <option value="lateral">🏃 Lateral</option>
                  <option value="volante">⚙️ Volante</option>
                  <option value="meia">🎯 Meia Armador</option>
                  <option value="atacante">⚡ Atacante</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Posição Secundária</label>
                <select
                  name="secondaryPosition"
                  value={formData.secondaryPosition}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Nenhuma (Especialista)</option>
                  <option value="goleiro">🧤 Goleiro</option>
                  <option value="zagueiro">🛡️ Zagueiro</option>
                  <option value="lateral">🏃 Lateral</option>
                  <option value="volante">⚙️ Volante</option>
                  <option value="meia">🎯 Meia Armador</option>
                  <option value="atacante">⚡ Atacante</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Perna Dominante</label>
                <select
                  name="dominantFoot"
                  value={formData.dominantFoot}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 capitalize"
                >
                  <option value="destro">Destro (Pé Direito)</option>
                  <option value="canhoto">Canhoto (Pé Esquerdo)</option>
                  <option value="ambidestro">Ambidestro (Ambos os Pés)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Altura (cm)</label>
                  <input
                    type="number"
                    name="heightCm"
                    value={formData.heightCm}
                    onChange={handleChange}
                    placeholder="180"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    name="weightKg"
                    value={formData.weightKg}
                    onChange={handleChange}
                    placeholder="80"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botão Salvar */}
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-3 px-6 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-spin" /> Salvando...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
