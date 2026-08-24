'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { maskCPF, maskPhone, maskCEP } from '@/lib/utils/masks';
import { validateCPF } from '@/lib/utils/cpf-validator';
import { fetchAddressByCEP } from '@/lib/utils/cep-service';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { AuthService } from '@/lib/services/auth-service';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Activity,
  Trophy,
  Smile,
  LogIn,
  UserPlus
} from 'lucide-react';
import { UserProfile, UserPosition, DominantFoot } from '@/types';

const POSITIONS = [
  { value: 'goleiro', label: '🧤 Goleiro', desc: 'Muralha debaixo das traves' },
  { value: 'zagueiro', label: '🛡️ Zagueiro', desc: 'Desarmes e liderança na zaga' },
  { value: 'lateral', label: '🏃 Lateral', desc: 'Apoio pelas pontas e marcação' },
  { value: 'volante', label: '⚙️ Volante', desc: 'Equilíbrio e contenção do meio' },
  { value: 'meia', label: '🎯 Meia Armador', desc: 'Visão de jogo e passes decisivos' },
  { value: 'atacante', label: '⚡ Atacante', desc: 'Finalização e faro de gol' },
];

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // --- ESTADO DO LOGIN COM EMAIL ---
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // --- ESTADO DO CADASTRO ---
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState<{
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
  }>({
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

  // HANDLER LOGIN POR EMAIL
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setLoginError('Informe seu e-mail.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLoginError('Informe um e-mail válido.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Informe sua senha de acesso.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const result = await AuthService.signInWithEmail(cleanEmail, loginPassword);
      if (!result.success) {
        setLoginError(result.error || 'Credenciais inválidas.');
        setLoginLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setLoginError('Erro ao autenticar.');
    } finally {
      setLoginLoading(false);
    }
  };

  // HANDLER CADASTRO CEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = maskCEP(raw);
    setRegisterForm((prev) => ({ ...prev, cep: formatted }));

    const clean = raw.replace(/\D/g, '');
    if (clean.length === 8) {
      setCepLoading(true);
      const res = await fetchAddressByCEP(clean);
      setCepLoading(false);

      if (res) {
        setRegisterForm((prev) => {
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

        if (registerErrors.cep || registerErrors.address) {
          setRegisterErrors((prev) => {
            const next = { ...prev };
            delete next.cep;
            delete next.address;
            return next;
          });
        }
      } else {
        setRegisterErrors((prev) => ({ ...prev, cep: 'CEP não encontrado.' }));
      }
    }
  };

  const handleAddressFieldChange = (field: 'street' | 'number' | 'neighborhood' | 'city' | 'state', value: string) => {
    setRegisterForm((prev) => {
      const updated = { ...prev, [field]: value };
      const full = `${updated.street || ''}${updated.number ? `, ${updated.number}` : ''}, ${updated.neighborhood || ''}, ${updated.city || ''} - ${updated.state || ''}${updated.cep ? ` (CEP: ${updated.cep})` : ''}`.replace(/^,\s*/, '');
      return { ...updated, address: full };
    });
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'cpf') formattedValue = maskCPF(value);
    if (name === 'phone') formattedValue = maskPhone(value);

    setRegisterForm((prev) => ({ ...prev, [name]: formattedValue }));
    if (registerErrors[name]) {
      setRegisterErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!registerForm.name.trim()) newErrors.name = 'Nome completo é obrigatório';
    if (!registerForm.email.includes('@') || !registerForm.email.includes('.')) newErrors.email = 'Informe um e-mail válido';
    if (registerForm.password.length < 6) newErrors.password = 'A senha deve ter no mínimo 6 caracteres';
    
    if (!registerForm.cpf) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(registerForm.cpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os dígitos.';
    }

    if (registerForm.phone.length < 14) newErrors.phone = 'Telefone/WhatsApp incompleto';
    if (!registerForm.cep || registerForm.cep.replace(/\D/g, '').length < 8) {
      newErrors.cep = 'Informe um CEP válido';
    }
    if (!registerForm.address.trim()) newErrors.address = 'Endereço residencial é obrigatório';

    setRegisterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextRegisterStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep1()) {
      setRegisterStep(2);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterLoading(true);

    try {
      const res = await AuthService.registerAthlete({
        name: registerForm.name,
        nickname: registerForm.nickname.trim() || undefined,
        avatarUrl: registerForm.avatarUrl || undefined,
        email: registerForm.email,
        password: registerForm.password,
        phone: registerForm.phone,
        cpf: registerForm.cpf,
        address: registerForm.address,
        mainPosition: registerForm.mainPosition,
        secondaryPosition: registerForm.secondaryPosition,
        dominantFoot: registerForm.dominantFoot,
        heightCm: registerForm.heightCm ? parseInt(registerForm.heightCm, 10) : undefined,
        weightKg: registerForm.weightKg ? parseFloat(registerForm.weightKg) : undefined,
      });

      if (!res.success) {
        alert(res.error || 'Erro ao cadastrar');
        setRegisterLoading(false);
        return;
      }

      setRegisteredSuccess(true);
    } catch (err) {
      alert('Erro ao realizar o cadastro.');
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090f16] text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Luz ambiente de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#00b49f]/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Header / Logo */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00b49f]/20 border border-[#00b49f]/40 flex items-center justify-center shadow-lg shadow-[#00b49f]/20">
            <Trophy className="w-6 h-6 text-[#00b49f]" />
          </div>
          <div>
            <span className="font-black text-lg text-white block leading-none tracking-tight">Reis da Pelada</span>
            <span className="text-[10px] text-[#00b49f] font-bold uppercase tracking-wider">Gestão & Resenha Oficial</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto my-auto py-6 relative z-10">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gestão Completa de Peladas
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 max-w-sm mx-auto">
            "Organiza o baba, equilibra o time e coroa a resenha."
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-[#121e2b] p-1 rounded-2xl border border-[#182737] flex items-center mb-5">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'login'
                ? 'bg-[#00b49f] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" /> Entrar no App
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setRegisterStep(1);
            }}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'register'
                ? 'bg-[#00b49f] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" /> Criar Conta
          </button>
        </div>

        {/* Card do Formulário */}
        <div className="bg-[#0d1721] border border-[#182737] rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
          
          {/* TAB 1: LOGIN POR EMAIL */}
          {activeTab === 'login' && (
            <div className="space-y-5">
              <GoogleAuthButton label="Continuar com o Google" />

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#182737]"></div>
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Ou acesse com seu E-mail
                </span>
                <div className="flex-grow border-t border-[#182737]"></div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="••••••••"
                      className="w-full bg-[#121e2b] border border-[#182737] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                    />
                  </div>
                </div>

                {loginError && (
                  <p className="text-rose-400 text-xs flex items-center gap-1.5 bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full mt-2 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00b49f]/20 transition-all active:scale-[0.99] disabled:opacity-50 text-sm"
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    <>
                      Entrar no App <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: CADASTRO */}
          {activeTab === 'register' && (
            <div>
              {registeredSuccess ? (
                <div className="text-center py-6 space-y-4">
                  {registerForm.avatarUrl ? (
                    <img
                      src={registerForm.avatarUrl}
                      alt={registerForm.name}
                      className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-[#00b49f] shadow-lg shadow-[#00b49f]/30"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-[#00b49f]/20 text-[#00b49f] rounded-full flex items-center justify-center mx-auto border border-[#00b49f]/40">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-white">Cadastro Concluído!</h2>
                  <p className="text-xs text-slate-300">
                    Atleta <strong className="text-[#00b49f]">{registerForm.name}</strong> {registerForm.nickname ? `(${registerForm.nickname})` : ''} registrado com sucesso.
                  </p>

                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full mt-4 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Trophy className="w-4 h-4" /> Acessar Painel
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {registerStep === 1 && (
                    <div className="space-y-4">
                      <GoogleAuthButton label="Cadastrar com o Google" />

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-[#182737]"></div>
                        <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Ou Cadastro Manual
                        </span>
                        <div className="flex-grow border-t border-[#182737]"></div>
                      </div>
                    </div>
                  )}

                  {/* Step Indicator */}
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        registerStep === 1 ? 'bg-[#00b49f] text-slate-950' : 'bg-[#0d4f48] text-[#00b49f]'
                      }`}>
                        {registerStep > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : '1'}
                      </div>
                      <span className="text-xs font-bold text-slate-200">Foto & Dados</span>
                    </div>
                    <div className="h-[2px] w-8 bg-[#182737]" />
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        registerStep === 2 ? 'bg-[#00b49f] text-slate-950' : 'bg-[#182737] text-slate-500'
                      }`}>
                        2
                      </div>
                      <span className="text-xs font-bold text-slate-200">Ficha Técnica</span>
                    </div>
                  </div>

                  {registerStep === 1 && (
                    <form onSubmit={handleNextRegisterStep} className="space-y-3.5">
                      
                      {/* Foto de Perfil */}
                      <div className="bg-[#121e2b]/50 border border-[#182737] p-3 rounded-2xl flex flex-col items-center">
                        <AvatarUpload
                          currentAvatarUrl={registerForm.avatarUrl}
                          onAvatarChange={(url) => setRegisterForm((prev) => ({ ...prev, avatarUrl: url }))}
                          label="Foto de Perfil"
                          size="sm"
                        />
                      </div>

                      {/* Nome e Apelido */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nome Completo</label>
                          <input
                            type="text"
                            name="name"
                            value={registerForm.name}
                            onChange={handleRegisterChange}
                            placeholder="Ex: Carlos Eduardo"
                            className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                          {registerErrors.name && <p className="text-rose-400 text-xs mt-1">{registerErrors.name}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Apelido (no Baba)</label>
                          <input
                            type="text"
                            name="nickname"
                            value={registerForm.nickname}
                            onChange={handleRegisterChange}
                            placeholder="Ex: Canhotinha"
                            className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">E-mail</label>
                          <input
                            type="email"
                            name="email"
                            value={registerForm.email}
                            onChange={handleRegisterChange}
                            placeholder="carlos@exemplo.com"
                            className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                          {registerErrors.email && <p className="text-rose-400 text-xs mt-1">{registerErrors.email}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Senha</label>
                          <input
                            type="password"
                            name="password"
                            value={registerForm.password}
                            onChange={handleRegisterChange}
                            placeholder="••••••••"
                            className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                          {registerErrors.password && <p className="text-rose-400 text-xs mt-1">{registerErrors.password}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">CPF (Verificação)</label>
                          <input
                            type="text"
                            name="cpf"
                            maxLength={14}
                            value={registerForm.cpf}
                            onChange={handleRegisterChange}
                            placeholder="000.000.000-00"
                            className="w-full bg-[#121e2b] font-mono border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                          {registerErrors.cpf && <p className="text-rose-400 text-xs mt-1">{registerErrors.cpf}</p>}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">WhatsApp</label>
                          <input
                            type="text"
                            name="phone"
                            maxLength={15}
                            value={registerForm.phone}
                            onChange={handleRegisterChange}
                            placeholder="(11) 98765-4321"
                            className="w-full bg-[#121e2b] border border-[#182737] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00b49f]"
                          />
                          {registerErrors.phone && <p className="text-rose-400 text-xs mt-1">{registerErrors.phone}</p>}
                        </div>
                      </div>

                      {/* CEP e Endereço */}
                      <div className="pt-2 border-t border-[#182737] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-[#00b49f] uppercase tracking-wider">
                            Endereço (Busca por CEP)
                          </label>
                          {cepLoading && <span className="text-[10px] text-[#00b49f] animate-pulse">Buscando CEP...</span>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            name="cep"
                            maxLength={9}
                            value={registerForm.cep}
                            onChange={handleCepChange}
                            placeholder="CEP 00000-000"
                            className="col-span-1 bg-[#121e2b] border border-[#00b49f]/40 rounded-xl px-3 py-2 text-xs text-white font-bold font-mono"
                          />
                          <input
                            type="text"
                            value={registerForm.street}
                            onChange={(e) => handleAddressFieldChange('street', e.target.value)}
                            placeholder="Rua / Logradouro"
                            className="col-span-2 bg-[#121e2b] border border-[#182737] rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-3 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg text-xs"
                      >
                        Avançar para Ficha Técnica <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  )}

                  {registerStep === 2 && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
                          Posição Principal
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {POSITIONS.map((pos) => (
                            <button
                              key={pos.value}
                              type="button"
                              onClick={() => setRegisterForm((prev) => ({ ...prev, mainPosition: pos.value as UserPosition }))}
                              className={`p-2 rounded-xl text-left border transition-all ${
                                registerForm.mainPosition === pos.value
                                  ? 'bg-[#00b49f]/20 border-[#00b49f] text-[#00b49f]'
                                  : 'bg-[#121e2b] border-[#182737] text-slate-400'
                              }`}
                            >
                              <p className="font-bold text-xs text-white">{pos.label}</p>
                              <p className="text-[10px] text-slate-400 line-clamp-1">{pos.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">Perna Dominante</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['destro', 'canhoto', 'ambidestro'].map((foot) => (
                            <button
                              key={foot}
                              type="button"
                              onClick={() => setRegisterForm((prev) => ({ ...prev, dominantFoot: foot as DominantFoot }))}
                              className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all ${
                                registerForm.dominantFoot === foot
                                  ? 'bg-[#00b49f]/20 border-[#00b49f] text-[#00b49f]'
                                  : 'bg-[#121e2b] border-[#182737] text-slate-400'
                              }`}
                            >
                              {foot}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setRegisterStep(1)}
                          className="w-1/3 bg-[#121e2b] hover:bg-[#182737] text-slate-300 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-1 text-xs"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>

                        <button
                          type="submit"
                          disabled={registerLoading}
                          className="w-2/3 bg-[#00b49f] hover:bg-[#00cba9] text-slate-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg text-xs"
                        >
                          {registerLoading ? 'Salvando...' : 'Concluir Cadastro'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto py-4 text-center text-xs text-slate-500 relative z-10 border-t border-[#182737]/60">
        © 2026 Reis da Pelada • Todos os direitos reservados.
      </footer>
    </div>
  );
}
