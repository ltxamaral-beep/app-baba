'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { mockUsers, mockMatch } from '@/lib/mock-data';
import { RatingService } from '@/lib/services/storage-service';
import { 
  Star, 
  Trophy, 
  CheckCircle2, 
  ArrowLeft, 
  Sparkles, 
  ThumbsUp, 
  Award, 
  Flame, 
  Shield 
} from 'lucide-react';

const TAGS = [
  { id: 'craque', label: '🏆 Craque da Pelada', color: 'border-amber-500/40 text-amber-300 bg-amber-500/10' },
  { id: 'paredao', label: '🧱 Paredão / Muralha', color: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' },
  { id: 'artilheiro', label: '⚽ Faro de Gol', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' },
  { id: 'garcom', label: '🎩 Garçom (Passes)', color: 'border-purple-500/40 text-purple-300 bg-purple-500/10' },
  { id: 'xerife', label: '🛡️ Xerife da Zaga', color: 'border-blue-500/40 text-blue-300 bg-blue-500/10' },
];

export default function PostMatchRatingPage({ params }: { params: { groupId: string; matchId: string } }) {
  const router = useRouter();
  const currentRater = mockUsers[0]; // Leandro avaliando os companheiros

  // Lista dos outros jogadores da pelada
  const otherPlayers = mockUsers.filter((u) => u.id !== currentRater.id);

  const [ratings, setRatings] = useState<Record<string, { rating: number; tag?: string }>>(() => {
    const initial: Record<string, { rating: number; tag?: string }> = {};
    otherPlayers.forEach((p) => {
      initial[p.id] = { rating: p.overallRating };
    });
    return initial;
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRatingChange = (userId: string, value: number) => {
    setRatings((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], rating: value },
    }));
  };

  const handleTagToggle = (userId: string, tagId: string) => {
    setRatings((prev) => {
      const current = prev[userId]?.tag;
      return {
        ...prev,
        [userId]: {
          ...prev[userId],
          tag: current === tagId ? undefined : tagId,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = Object.entries(ratings).map(([ratedUserId, data]) => ({
        ratedUserId,
        rating: data.rating,
        tag: data.tag,
      }));

      RatingService.submitRatings(params.matchId, currentRater.id, payload);
      await new Promise((r) => setTimeout(r, 800));
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Award className="w-3.5 h-3.5" /> Pós-Pelada & Cartola
            </div>
            <h1 className="text-2xl font-black text-white">Votação de Notas & Craque</h1>
            <p className="text-xs text-slate-400">
              Avalie o desempenho dos seus colegas de time para calibrar a média geral dos próximos sorteios.
            </p>
          </div>
        </div>
      </div>

      {submitted ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Notas Registradas com Sucesso!</h2>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            O algoritmo de sorteio computou suas avaliações e atualizou as médias de habilidade de todos os atletas para o próximo confronto.
          </p>

          <div className="pt-4 flex justify-center gap-3">
            <Link
              href={`/grupos/${params.groupId}/peladas/${params.matchId}/sorteio`}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Trophy className="w-4 h-4" /> Ver Próximo Sorteio Calibrado
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otherPlayers.map((player) => {
              const currentVal = ratings[player.id]?.rating ?? 6.0;
              const selectedTag = ratings[player.id]?.tag;

              return (
                <div
                  key={player.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                        {player.mainPosition.substring(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{player.name}</h3>
                        <p className="text-[11px] text-slate-400 capitalize">{player.mainPosition} • {player.dominantFoot}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-amber-400 flex items-center gap-1 justify-end">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        {currentVal.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Slider de Nota (1 a 10) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                      <span>Nota 1.0</span>
                      <span>Nota 5.5</span>
                      <span>Nota 10.0</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={currentVal}
                      onChange={(e) => handleRatingChange(player.id, parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Tags / Selos de Destaque */}
                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1.5">
                      Destaque da Partida:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {TAGS.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleTagToggle(player.id, tag.id)}
                          className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-all ${
                            selectedTag === tag.id
                              ? `${tag.color} ring-1 font-bold`
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 px-6 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all text-sm disabled:opacity-50"
          >
            {loading ? 'Processando Médias...' : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Enviar Votação & Recalcular Médias de Sorteio
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
