'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GroupService } from '@/lib/services/storage-service';
import { maskCEP } from '@/lib/utils/masks';
import { fetchAddressByCEP } from '@/lib/utils/cep-service';
import { SoccerType } from '@/types';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  PlusCircle, 
  Info,
  CheckCircle2,
  Activity,
  Building,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';

export default function CreateGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    soccerType: 'society' as SoccerType,
    playersPerTeam: 6,
    maxSlots: 24,
    venueName: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    fieldAddress: '',
    matchDay: 'Quinta-feira',
    matchTime: '20:00',
    matchDurationMinutes: 90,
    monthlyFee: 80.00,
    dailyFee: 25.00,
    whatsappGroupUrl: '',
    rules: '• Chegar com 15 min de antecedência\n• Uso de caneleira recomendado\n• Pagamento da mensalidade até o dia 10',
    isPublic: true,
  });

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
          const fullAddress = `${prev.venueName ? `${prev.venueName} - ` : ''}${street}${prev.number ? `, ${prev.number}` : ''}, ${neighborhood}, ${city} - ${state} (CEP: ${formatted})`;

          return {
            ...prev,
            street,
            neighborhood,
            city,
            state,
            fieldAddress: fullAddress,
          };
        });
      }
    }
  };

  const handleAddressFieldChange = (field: 'venueName' | 'street' | 'number' | 'neighborhood' | 'city' | 'state', value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      const venuePrefix = updated.venueName ? `${updated.venueName} - ` : '';
      const streetPart = updated.street || '';
      const numPart = updated.number ? `, ${updated.number}` : '';
      const neighPart = updated.neighborhood ? `, ${updated.neighborhood}` : '';
      const cityPart = updated.city ? `, ${updated.city}` : '';
      const statePart = updated.state ? ` - ${updated.state}` : '';
      const cepPart = updated.cep ? ` (CEP: ${updated.cep})` : '';

      const full = `${venuePrefix}${streetPart}${numPart}${neighPart}${cityPart}${statePart}${cepPart}`.trim();
      return { ...updated, fieldAddress: full };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSelectType = (type: SoccerType, defaultPlayers: number) => {
    setFormData((prev) => ({
      ...prev,
      soccerType: type,
      playersPerTeam: defaultPlayers,
      maxSlots: defaultPlayers * 3,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Informe o nome da pelada / grupo.');
      return;
    }
    if (!formData.fieldAddress.trim()) {
      alert('Informe o endereço ou CEP da quadra / campo.');
      return;
    }

    setLoading(true);
    try {
      await GroupService.createGroup({
        name: formData.name,
        soccerType: formData.soccerType,
        playersPerTeam: formData.playersPerTeam,
        maxSlots: formData.maxSlots,
        fieldAddress: formData.fieldAddress,
        matchDay: formData.matchDay,
        matchTime: formData.matchTime,
        matchDurationMinutes: formData.matchDurationMinutes,
        rules: formData.rules,
        monthlyFee: formData.monthlyFee,
        dailyFee: formData.dailyFee,
        isPublic: formData.isPublic,
        whatsappGroupUrl: formData.whatsappGroupUrl.trim(),
      });

      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      alert('Erro ao criar o grupo. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <PlusCircle className="w-3.5 h-3.5" /> Novo Grupo
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Criar Grupo de Pelada</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Você será o <strong>Presidente Titular</strong> deste grupo com controle total de finanças, sorteios e lista de presença.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* 1. Identificação Básica */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">1</span>
            Informações do Grupo
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Nome do Grupo / Pelada *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Pelada dos Amigos FC, Quinta dos Boleiros"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 font-bold"
            />
          </div>

          {/* Modalidade */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Tipo de Futebol
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { type: 'society', label: 'Society (6x6 / 7x7)', players: 6, icon: '🌱' },
                { type: 'campo', label: 'Campo Grande (11x11)', players: 11, icon: '⚽' },
                { type: 'futsal', label: 'Futsal / Salão (5x5)', players: 5, icon: '👟' },
                { type: 'barro', label: 'Terrão / Barro', players: 6, icon: '🧱' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleSelectType(item.type as SoccerType, item.players)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    formData.soccerType === item.type
                      ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-xl mb-1">{item.icon}</span>
                  <span className="text-xs font-bold block">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Endereço da Quadra / Campo com CEP */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">2</span>
            Local, Dia e Horário
          </h2>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Endereço da Quadra / Campo (Busca Automática por CEP) *
              </label>
              {cepLoading && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 animate-spin" /> Buscando CEP...
                </span>
              )}
            </div>

            <div>
              <input
                type="text"
                value={formData.venueName}
                onChange={(e) => handleAddressFieldChange('venueName', e.target.value)}
                placeholder="Nome da Arena / Quadra (Ex: Arena Salvador, Clube dos Funcionários)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-bold"
              />
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
                  placeholder="Rua / Avenida da Quadra"
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Dia da Semana</label>
              <select
                name="matchDay"
                value={formData.matchDay}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
              >
                <option value="Segunda-feira">Segunda-feira</option>
                <option value="Terça-feira">Terça-feira</option>
                <option value="Quarta-feira">Quarta-feira</option>
                <option value="Quinta-feira">Quinta-feira</option>
                <option value="Sexta-feira">Sexta-feira</option>
                <option value="Sábado">Sábado</option>
                <option value="Domingo">Domingo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Horário de Início</label>
              <input
                type="time"
                name="matchTime"
                value={formData.matchTime}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Duração (Minutos)</label>
              <input
                type="number"
                name="matchDurationMinutes"
                value={formData.matchDurationMinutes}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-emerald-400 uppercase mb-1.5 font-bold">Vagas na Pelada *</label>
              <input
                type="number"
                name="maxSlots"
                min="10"
                max="50"
                value={formData.maxSlots}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-emerald-500/50 rounded-xl px-3.5 py-2.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* 3. Valores Financeiros */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">3</span>
            Valores Financeiros (Opcional)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Mensalidade do Associado (R$)
              </label>
              <input
                type="number"
                step="5.00"
                name="monthlyFee"
                value={formData.monthlyFee}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                Diária do Diarista Avulso (R$)
              </label>
              <input
                type="number"
                step="5.00"
                name="dailyFee"
                value={formData.dailyFee}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>
          </div>
        </div>

        {/* 4. Grupo do WhatsApp da Pelada */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-black">4</span>
            Grupo de WhatsApp do Baba (Opcional)
          </h2>

          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-400 uppercase mb-1.5 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> Link do Grupo no WhatsApp
              </label>
              <input
                type="url"
                name="whatsappGroupUrl"
                value={formData.whatsappGroupUrl}
                onChange={handleChange}
                placeholder="Ex: https://chat.whatsapp.com/ABC123xyz..."
                className="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Como funciona:</strong> Ao adicionar o link aqui, todos os membros que entrarem pelo código ou convite terão um botão direto para <strong>entrar no grupo de WhatsApp da sua pelada</strong> com 1 clique.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black py-4 px-6 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all disabled:opacity-50"
        >
          {loading ? 'Criando Grupo...' : 'Criar Grupo & Ser Presidente'} <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
