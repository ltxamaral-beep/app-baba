import streamlit as st
import pandas as pd
import datetime

# Configuração da Página
st.set_page_config(page_title="Gestão - Baba da Irmandade", layout="wide", page_icon="⚽")

# Abas Principais
tab1, tab2, tab3 = st.tabs(["📊 Estatísticas & Partidas", "👥 Sorteio de Times", "💰 Controle Financeiro"])

# ==========================================
# ABA 1: ESTATÍSTICAS & PARTIDAS (Lê banco_de_dados_baba.xlsx)
# ==========================================
with tab1:
    st.title("🏆 Painel de Estatísticas - Baba da Irmandade")
    st.markdown("Acompanhe em tempo real os resultados, artilheiros e a classificação do nosso baba!")
    st.divider()

    try:
        df_atletas = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Atletas")
        df_partidas = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Partidas")
        df_eventos = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Eventos")
        
        st.subheader("📊 Classificação Final (Pontos Corridos)")
        times = pd.concat([df_partidas['Equipe_A'], df_partidas['Equipe_B']]).unique()
        classificacao = []
        
        for time in times:
            jogos_A = df_partidas[df_partidas['Equipe_A'] == time]
            jogos_B = df_partidas[df_partidas['Equipe_B'] == time]
            
            vitorias = len(jogos_A[jogos_A['Gols_A'] > jogos_A['Gols_B']]) + len(jogos_B[jogos_B['Gols_B'] > jogos_B['Gols_A']])
            empates = len(jogos_A[jogos_A['Gols_A'] == jogos_A['Gols_B']]) + len(jogos_B[jogos_B['Gols_B'] == jogos_B['Gols_A']])
            derrotas = len(jogos_A[jogos_A['Gols_A'] < jogos_A['Gols_B']]) + len(jogos_B[jogos_B['Gols_B'] < jogos_B['Gols_A']])
            
            gols_pro = jogos_A['Gols_A'].sum() + jogos_B['Gols_B'].sum()
            gols_sofridos = jogos_A['Gols_B'].sum() + jogos_B['Gols_A'].sum()
            
            classificacao.append({
                "Time": time,
                "Jogos": len(jogos_A) + len(jogos_B),
                "Vitórias": vitorias,
                "Empates": empates,
                "Derrotas": derrotas,
                "Gols Pró": gols_pro,
                "Gols Sofridos": gols_sofridos,
                "Saldo": gols_pro - gols_sofridos,
                "Pontos": (vitorias * 3) + (empates * 1)
            })
            
        df_classificacao = pd.DataFrame(classificacao).sort_values(by=["Pontos", "Saldo", "Gols Pró"], ascending=False).reset_index(drop=True)
        df_classificacao.index += 1
        st.dataframe(df_classificacao, use_container_width=True)
        st.divider()

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("⚽ Artilharia")
            gols = df_eventos[df_eventos['Evento'] == 'Gol']
            if not gols.empty:
                artilharia = gols.groupby('Nome').size().reset_index(name='Gols')
                artilharia = artilharia.sort_values(by='Gols', ascending=False).reset_index(drop=True)
                artilharia.index += 1
                st.dataframe(artilharia, use_container_width=True)
            else:
                st.info("Nenhum gol registrado ainda.")
                
        with col2:
            st.subheader("👟 Líderes de Assistências")
            assistencias = df_eventos[df_eventos['Evento'] == 'Assistencia']
            if not assistencias.empty:
                ranking_assist = assistencias.groupby('Nome').size().reset_index(name='Assistências')
                ranking_assist = ranking_assist.sort_values(by='Assistências', ascending=False).reset_index(drop=True)
                ranking_assist.index += 1
                st.dataframe(ranking_assist, use_container_width=True)
            else:
                st.info("Nenhuma assistência registrada ainda.")

        st.divider()
        st.subheader("🗓️ Últimos Confrontos")
        df_exibicao = df_partidas[['Data', 'Equipe_A', 'Gols_A', 'Gols_B', 'Equipe_B']].copy()
        df_exibicao.columns = ['Data', 'Time Mandante', 'Gols Mandante', 'Gols Visitante', 'Time Visitante']
        st.dataframe(df_exibicao, use_container_width=True)
        
    except Exception as e:
        st.info("💡 Para visualizar as estatísticas detalhadas de partidas e artilharia, certifique-se de que o arquivo 'banco_de_dados_baba.xlsx' está no GitHub junto com o controle financeiro.")

# ==========================================
# ABA 2: SORTEIO DE TIMES
# ==========================================
with tab2:
    st.title("🎲 Gerador de Sorteio Equilibrado")
    st.markdown("Ferramenta para divisão de 4 times baseada nas posições e níveis dos atletas para o jogo de amanhã às 08h.")
    
    if st.button("Gerar Sorteio Oficial para o Jogo"):
        st.success("Sorteio gerado com sucesso!")
        c1, c2, c3, c4 = st.columns(4)
        
        with c1:
            st.markdown("### 🟢 Time 1 (Nv 4.40)")
            st.markdown("- Sidnei (Zag | 4)\n- Leo Pereira (Mei | 5)\n- Leandro (Mei | 4)\n- Paulo Jesus (Mei | 4)\n- Daniel C. Freitas (Atc | 5)")
        with c2:
            st.markdown("### ⚪ Time 2 (Nv 4.00)")
            st.markdown("- Sandro dos Santos (Zag | 4)\n- Danilo Vilar (Mei | 5)\n- Jailton (Mei | 4)\n- Júnior (Mei | 3)\n- Junior Bitoca (Atc | 4)")
        with c3:
            st.markdown("### 🔴 Time 3 (Nv 3.60)")
            st.markdown("- Lucas (Zag | 3)\n- Antonio (Mei | 5)\n- Fernando (Mei | 4)\n- Luan Damásio (Mei | 3)\n- Neno (Atc | 3)")
        with c4:
            st.markdown("### 🔵 Time 4 (Nv 3.60)")
            st.markdown("- Nicolas (Zag | 3)\n- Peruka (Mei | 5)\n- Jeff (Mei | 4)\n- Rafael (Mei | 3)\n- Felipe (Atc | 3)")
            
        st.info("💡 **Goleiros:** Vitholly e David revezam ou fixam nos gols. **Fora:** Jhonny.")

# ==========================================
# ABA 3: CONTROLE FINANCEIRO (Lê Controle Grupo Irmandade.xlsx)
# ==========================================
with tab3:
    st.title("💰 Controle Financeiro - Grupo Irmandade")
    st.markdown("Acompanhamento de fluxo de caixa, custos por categoria e inadimplência dos associados.")
    st.divider()

    try:
        df_fluxo = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Fluxo_de_Caixa")
        df_mensalidades = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Lançamentos_Mensalidades")
        
        # Métricas principais
        total_entradas = df_fluxo[df_fluxo['Tipo'] == 'Entrada']['Valor'].sum()
        total_saidas = df_fluxo[df_fluxo['Tipo'] == 'Saída']['Valor'].sum()
        saldo_caixa = total_entradas - total_saidas
        
        col_m1, col_m2, col_m3 = st.columns(3)
        col_m1.metric("Total Entradas", f"R$ {total_entradas:,.2f}")
        col_m2.metric("Total Saídas", f"R$ {total_saidas:,.2f}")
        col_m3.metric("Saldo em Caixa", f"R$ {saldo_caixa:,.2f}", delta_color="normal" if saldo_caixa >= 0 else "inverse")
        
        st.divider()
        
        # Custos por Categoria (Saídas)
        st.subheader("📉 Custos por Categoria (Saídas)")
        saidas_df = df_fluxo[df_fluxo['Tipo'] == 'Saída']
        custos_categoria = saidas_df.groupby('Categoria')['Valor'].sum().reset_index()
        custos_categoria.columns = ['Categoria', 'Valor Total (R$)']
        st.dataframe(custos_categoria, use_container_width=True)
        
        st.divider()
        
        # Status Financeiro dos Associados
        st.subheader("👥 Status Financeiro dos Associados")
        
        status_associados = df_mensalidades.groupby('Associado').agg({
            'Valor Devido': 'sum',
            'Valor Pago': 'sum'
        }).reset_index()
        
        status_associados['Saldo Devedor'] = status_associados['Valor Devido'] - status_associados['Valor Pago']
        status_associados['Status'] = status_associados['Saldo Devedor'].apply(lambda x: 'Em Dia 🟢' if x <= 0 else 'Pendente 🔴')
        
        col_a1, col_a2 = st.columns(2)
        
        with col_a1:
            st.markdown("#### 🔴 Associados com Pendência")
            pendentes = status_associados[status_associados['Status'] == 'Pendente 🔴']
            if not pendentes.empty:
                st.dataframe(pendentes[['Associado', 'Valor Devido', 'Valor Pago', 'Saldo Devedor']], use_container_width=True)
            else:
                st.success("Nenhum associado com pendência!")
                
        with col_a2:
            st.markdown("#### 🟢 Associados em Dia")
            em_dia = status_associados[status_associados['Status'] == 'Em Dia 🟢']
            if not em_dia.empty:
                st.dataframe(em_dia[['Associado', 'Valor Devido', 'Valor Pago']], use_container_width=True)
            else:
                st.info("Nenhum associado em dia registrado.")
                
        st.divider()
        st.subheader("📋 Histórico Completo do Fluxo de Caixa")
        st.dataframe(df_fluxo, use_container_width=True)

    except Exception as e:
        st.error(f"Erro ao carregar dados financeiros: {e}")