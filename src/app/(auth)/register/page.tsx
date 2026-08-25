'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { validateCPF } from '@/lib/utils/cpf-validator';
import { maskCPF, maskPhone, maskCEP } from '@/lib/utils/masks';
import { fetchAddressByCEP } from '@/lib/utils/cep-service';
import { AuthService } from '@/lib/services/auth-service';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { 
  ShieldCheck, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Trophy,
  Sparkles,
  Activity,
  Smile
} from 'lucide-react';
import { UserPosition, DominantFoot } from '@/types';

interface FormData {
  name: string;
  nickname: string;
  avatarUrl: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  address: string;
  mainPosition: UserPosition;
  secondaryPosition: UserPosition | '';
  dominantFoot: DominantFoot;
  heightCm: string;
  weightKg: string;
}

const POSITIONS = [
  { value: 'goleiro', label: '🧤 Goleiro', desc: 'Muralha debaixo das traves' },
  { value: 'zagueiro', label: '🛡️ Zagueiro', desc: 'Desarmes e liderança na zaga' },
  { value: 'lateral', label: '🏃 Lateral', desc: 'Apoio pelas pontas e marcação' },
  { value: 'volante', label: '⚙️ Volante', desc: 'Equilíbrio e contenção do meio' },
  { value: 'meia', label: '🎯 Meia Armador', desc: 'Visão de jogo e passes decisivos' },
  { value: 'atacante', label: '⚡ Atacante', desc: 'Finalização e faro de gol' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    nickname: '',
    avatarUrl: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    address: '',
    mainPosition: 'meia',
    secondaryPosition: '',
    dominantFoot: 'destro',
    heightCm: '',
    weightKg: '',
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

        if (errors.cep || errors.address) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next.cep;
            delete next.address;
            return next;
          });
        }
      } else {
        setErrors((prev) => ({ ...prev, cep: 'CEP não encontrado.' }));
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

    if (name === 'cpf') formattedValue = maskCPF(value);
    if (name === 'phone') formattedValue = maskPhone(value);

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Nome completo é obrigatório';
    if (!formData.email.includes('@') || !formData.email.includes('.')) newErrors.email = 'Informe um e-mail válido';
    if (formData.password.length < 6) newErrors.password = 'A senha deve ter no mínimo 6 caracteres';
    
    // Validação estrita de CPF com cálculo mod 11
    if (!formData.cpf) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(formData.cpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os dígitos.';
    }

    if (formData.phone.length < 14) newErrors.phone = 'Telefone/WhatsApp incompleto';
    if (!formData.cep || formData.cep.replace(/\D/g, '').length < 8) {
      newErrors.cep = 'Informe um CEP válido';
    }
    if (!formData.address.trim()) newErrors.address = 'Endereço residencial é obrigatório';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await AuthService.registerAthlete({
        name: formData.name,
        nickname: formData.nickname.trim() || undefined,
        avatarUrl: formData.avatarUrl || undefined,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        cpf: formData.cpf,
        cep: formData.cep,
        street: formData.street,
        number: formData.number,
        neighborhood: formData.neighborhood,
        city: formData.city,
        state: formData.state,
        address: formData.address,
        mainPosition: formData.mainPosition,
        secondaryPosition: formData.secondaryPosition,
        dominantFoot: formData.dominantFoot,
        heightCm: formData.heightCm ? parseInt(formData.heightCm, 10) : undefined,
        weightKg: formData.weightKg ? parseFloat(formData.weightKg) : undefined,
      });

      if (!res.success) {
        alert(res.error || 'Erro ao realizar cadastro.');
        setLoading(false);
        return;
      }

      setRegisteredSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Erro ao realizar o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090f16] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00b49f]/10 blur-[140px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 relative z-10 flex flex-col items-center">
        <Link href="/" className="flex items-center gap-2.5 mb-3 group">
          <div className="w-12 h-12 rounded-2xl bg-[#00b49f]/20 border border-[#00b49f]/40 flex items-center justify-center shadow-lg shadow-[#00b49f]/20 group-hover:scale-105 transition-transform">
            <Trophy className="w-6 h-6 text-[#00b49f]" />
          </div>
          <div className="text-left">
            <span className="font-black text-base text-white block leading-none">Reis da Pelada</span>
            <span className="text-[10px] text-[#00b49f] font-bold uppercase">Plataforma Oficial</span>
          </div>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Cadastro de Atleta
        </h1>
        <p className="text-slate-400 text-xs mt-1.5 max-w-md mx-auto">
          "Organiza o baba, equilibra o time e coroa a resenha."
        </p>
      </div>

      {/* Card Container */}
      <div className="w-full max-w-lg bg-[#0d1721] border border-[#182737] rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-5">
        {registeredSuccess ? (
          <div className="text-center py-6 space-y-4">
            {formData.avatarUrl ? (
              <img
                src={formData.avatarUrl}
                alt={formData.name}
                className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-[#00b49f] shadow-lg shadow-[#00b49f]/30"
              />
            ) : (
              <div className="w-16 h-16 bg-[#00b49f]/20 text-[#00b49f] rounded-full flex items-center justify-center mx-auto border border-[#00b49f]/40">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            )}
            
            <div>
              <h2 className="text-2xl font-bold text-white">Cadastro Concluído com Sucesso!</h2>
              {formData.nickname && (
                <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-[#00b49f]/20 text-[#00b49f] font-bold text-xs border border-[#00b49f]/30">
                  Apelido: {formData.nickname}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 max-w-sm mx-auto">
              Seu perfil de atleta <strong className="text-[#00b49f]">{formData.name}</strong> foi criado com CPF verificado e nota inicial calibrada.
            </p>

            <div className="bg-[#121e2b] border border-[#182737] rounded-2xl p-4 text-left text-xs space-y-2 mt-4">
              <div className="flex justify-between text-slate-400">
                <span>Posição Principal:</span>
                <span className="font-bold text-[#00b49f] capitalize">{formData.mainPosition}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Perna Dominante:</span>
                <span className="font-semibold text-slate-200 capitalize">{formData.dominantFoot}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Nota Inicial de Sorteio:</span>
                <span className="font-semibold text-amber-400">⭐ 6.50 (Calibrada automaticamente)</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2.5">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00b49f]/20 transition-all"
              >
                <Trophy className="w-4 h-4" /> Entrar no Painel do Baba
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Opção 1: Cadastro Rápido com Google (quando na etapa 1) */}
            {step === 1 && (
              <div className="space-y-4">
              </div>
            )}

            {/* Step Indicator */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step === 1 ? 'bg-[#00b49f] text-slate-950 shadow-lg shadow-[#00b49f]/30' : 'bg-[#0d4f48] text-[#00b49f]'
                }`}>
                  {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Etapa 1</p>
                  <p className="text-xs font-bold text-slate-200">Foto & Dados Pessoais</p>
                </div>
              </div>
              
              <div className="h-[2px] w-12 bg-[#182737]" />

              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step === 2 ? 'bg-[#00b49f] text-slate-950 shadow-lg shadow-[#00b49f]/30' : 'bg-[#182737] text-slate-500'
                }`}>
                  2
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Etapa 2</p>
                  <p className="text-xs font-bold text-slate-200">Ficha Técnica</p>
                </div>
              </div>
            </div>

            {/* STEP 1: FOTO, DADOS PESSOAIS & CPF & CEP */}
            {step === 1 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                
                {/* 1. Foto de Perfil do Atleta */}
                <div className="bg-[#121e2b]/60 border border-[#182737] p-4 rounded-2xl flex flex-col items-center justify-center">
                  <AvatarUpload
                    currentAvatarUrl={formData.avatarUrl}
                    onAvatarChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                    label="Foto de Perfil do Atleta"
                    size="md"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Sua foto aparecerá na lista de presença e nos times do sorteio.</p>
                </div>

                {/* Nome Completo e Apelido */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Ex: Carlos Eduardo"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                    {errors.name && <p className="text-rose-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> {errors.name}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300 uppercase">Apelido</label>
                      <span className="text-[10px] text-[#00b49f] font-medium">No baba</span>
                    </div>
                    <div className="relative">
                      <Smile className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleChange}
                        placeholder="Ex: Canhota, Baixinho..."
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                  </div>
                </div>

                {/* Email e Senha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="carlos@exemplo.com"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                    {errors.email && <p className="text-rose-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> {errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                    {errors.password && <p className="text-rose-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> {errors.password}</p>}
                  </div>
                </div>

                {/* CPF e WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                      CPF <span className="text-[#00b49f] text-[10px] lowercase font-normal">(validação real)</span>
                    </label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        name="cpf"
                        maxLength={14}
                        value={formData.cpf}
                        onChange={handleChange}
                        placeholder="000.000.000-00"
                        className={`w-full bg-[#121e2b] border font-mono rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none ${
                          errors.cpf ? 'border-rose-500' : 'border-[#182737] focus:border-[#00b49f]'
                        }`}
                      />
                    </div>
                    {errors.cpf && <p className="text-rose-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0"/> {errors.cpf}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        name="phone"
                        maxLength={15}
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="(11) 98765-4321"
                        className="w-full bg-[#121e2b] border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                    {errors.phone && <p className="text-rose-400 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> {errors.phone}</p>}
                  </div>
                </div>

                {/* Endereço com CEP */}
                <div className="pt-2 border-t border-[#182737] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#00b49f] uppercase tracking-wider">
                      Endereço (Busca por CEP)
                    </label>
                    {cepLoading && (
                      <span className="text-[10px] text-[#00b49f] flex items-center gap-1">
                        <Activity className="w-3 h-3 animate-spin" /> Buscando...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <input
                        type="text"
                        name="cep"
                        maxLength={9}
                        value={formData.cep}
                        onChange={handleCepChange}
                        placeholder="00000-000"
                        className="w-full bg-[#121e2b] border border-[#00b49f]/40 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-[#00b49f] font-bold"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => handleAddressFieldChange('street', e.target.value)}
                        placeholder="Rua / Logradouro"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <input
                        type="text"
                        value={formData.number}
                        onChange={(e) => handleAddressFieldChange('number', e.target.value)}
                        placeholder="Número"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="text"
                        value={formData.neighborhood}
                        onChange={(e) => handleAddressFieldChange('neighborhood', e.target.value)}
                        placeholder="Bairro"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => handleAddressFieldChange('city', e.target.value)}
                        placeholder="Cidade"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                      />
                    </div>

                    <div className="col-span-1">
                      <input
                        type="text"
                        maxLength={2}
                        value={formData.state}
                        onChange={(e) => handleAddressFieldChange('state', e.target.value.toUpperCase())}
                        placeholder="UF"
                        className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-[#00b49f] text-center font-bold"
                      />
                    </div>
                  </div>

                  {errors.cep && <p className="text-rose-400 text-xs">{errors.cep}</p>}
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.99]"
                >
                  Avançar para Ficha Técnica <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 2: FICHA TÉCNICA DO ATLETA */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Posição Principal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Posição Principal de Jogo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, mainPosition: pos.value as UserPosition }))}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          formData.mainPosition === pos.value
                            ? 'bg-[#00b49f]/20 border-[#00b49f] text-[#00b49f] shadow-md shadow-[#00b49f]/10'
                            : 'bg-[#121e2b] border-[#182737] text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <p className="font-bold text-xs text-white">{pos.label}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{pos.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Perna Dominante */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Perna Dominante</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['destro', 'canhoto', 'ambidestro'].map((foot) => (
                      <button
                        key={foot}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, dominantFoot: foot as DominantFoot }))}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                          formData.dominantFoot === foot
                            ? 'bg-[#00b49f]/20 border-[#00b49f] text-[#00b49f]'
                            : 'bg-[#121e2b] border-[#182737] text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {foot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Altura e Peso */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      name="heightCm"
                      value={formData.heightCm}
                      onChange={handleChange}
                      placeholder="Ex: 178"
                      className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.5"
                      name="weightKg"
                      value={formData.weightKg}
                      onChange={handleChange}
                      placeholder="Ex: 75.5"
                      className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                    />
                  </div>
                </div>

                <div className="bg-[#0d4f48]/40 border border-[#147067]/40 rounded-xl p-3 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#00b49f] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Sua posição e atributos serão calibrados no sorteio inteligente do Baba para manter as equipes niveladas.
                  </p>
                </div>

                {/* Ações */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-1/3 bg-[#121e2b] hover:bg-[#182737] text-slate-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1 transition-colors text-xs"
                  >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.99] disabled:opacity-50 text-xs"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Salvando...
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Concluir Cadastro
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400 mt-6 relative z-10">
        Já possui cadastro? <Link href="/login" className="text-[#00b49f] font-bold hover:underline">Fazer Login</Link>
      </p>
    </div>
  );
}
