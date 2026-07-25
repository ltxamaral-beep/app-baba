import streamlit as st
import pandas as pd
import datetime
import random

# Configuração da Página
st.set_page_config(
    page_title="Gestão - Baba da Irmandade", 
    layout="wide", 
    page_icon="⚽"
)

# Inserindo CSS Personalizado para um Visual Profissional
st.markdown("""
    <style>
        /* Fundo principal e fontes */
        .main {
            background-color: #f8f9fa;
        }
        h1, h2, h3 {
            color: #1f2937;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        /* Estilização dos Cartões de Métricas */
        div[data-testid="metric-container"] {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        div[data-testid="metric-container"] label {
            color: #4b5563;
            font-weight: 600;
        }
        /* Botões customizados */
        .stButton>button {
            border-radius: 8px;
            font-weight: bold;
            padding: 0.5rem 1rem;
            transition: all 0.3s ease;
        }
        /* Ajuste de abas */
        .stTabs [data-baseweb="tab-list"] {
            gap: 10px;
        }
        .stTabs [data-baseweb="tab"] {
            background-color: #ffffff;
            border-radius: 8px 8px 0px 0px;
            padding: 10px 20px;
            font-weight: bold;
            border: 1px solid #e5e7eb;
        }
        .stTabs [aria-selected="true"] {
            background-color: #1f2937 !important;
            color: white !important;
        }
    </style>
""", unsafe_allow_html=True)

# Abas Principais
tab1, tab2, tab3, tab4 = st.tabs([
    "📅 Rodada de Domingo (Presença & Sorteio)", 
    "🏆 Classificação, Artilharia & Ranking Anual", 
    "👥 Sorteio de Times", 
    "💰 Controle Financeiro"
])

# ==========================================
# ABA 1: RODADA DE DOMINGO (Lista de Presença & Sorteio Automático)
# ==========================================
with tab1:
    st.title("⚽ Gestão da Rodada de Domingo")
    st.markdown("Confirme a **Lista de Presença** dos atletas para o jogo e realize o sorteio equilibrado dos 4 times.")
    st.divider()

    atletas_cadastrados = [
        {"Nome": "Vitholly", "Posicao": "Goleiro", "Nivel": 5, "Tipo": "Confirmado"},
        {"Nome": "David", "Posicao": "Goleiro", "Nivel": 3, "Tipo": "Confirmado"},
        {"Nome": "Lucas", "Posicao": "Zagueiro", "Nivel": 3, "Tipo": "Confirmado"},
        {"Nome": "Sidnei", "Posicao": "Zagueiro", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Sandro dos Santos", "Posicao": "Zagueiro", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Nicolas", "Posicao": "Zagueiro", "Nivel": 3, "Tipo": "Convidado"},
        {"Nome": "Leo Pereira", "Posicao": "Meio-campo", "Nivel": 5, "Tipo": "Confirmado"},
        {"Nome": "Jeff", "Posicao": "Meio-campo", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Fernando", "Posicao": "Meio-campo", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Danilo Vilar Santana", "Posicao": "Meio-campo", "Nivel": 5, "Tipo": "Confirmado"},
        {"Nome": "Jailton", "Posicao": "Meio-campo", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Leandro", "Posicao": "Meio-campo", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Júnior", "Posicao": "Meio-campo", "Nivel": 3, "Tipo": "Confirmado"},
        {"Nome": "Luan Damásio", "Posicao": "Meio-campo", "Nivel": 3, "Tipo": "Confirmado"},
        {"Nome": "Paulo Jesus", "Posicao": "Meio-campo", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Antonio", "Posicao": "Meio-campo", "Nivel": 5, "Tipo": "Convidado"},
        {"Nome": "Peruka", "Posicao": "Meio-campo", "Nivel": 5, "Tipo": "Convidado"},
        {"Nome": "Jhonny", "Posicao": "Meio-campo", "Nivel": 2, "Tipo": "Convidado"},
        {"Nome": "Rafael", "Posicao": "Meio-campo", "Nivel": 3, "Tipo": "Convidado"},
        {"Nome": "Junior Bitoca", "Posicao": "Atacante", "Nivel": 4, "Tipo": "Confirmado"},
        {"Nome": "Daniel Carneiro Freitas", "Posicao": "Atacante", "Nivel": 5, "Tipo": "Confirmado"},
        {"Nome": "Neno", "Posicao": "Atacante", "Nivel": 3, "Tipo": "Convidado"},
        {"Nome": "Felipe", "Posicao": "Atacante", "Nivel": 3, "Tipo": "Convidado"},
    ]

    st.subheader("📋 Lista de Chamada / Confirmação de Presença")
    st.markdown("Marque quem confirmou presença para a partida:")

    presencoes_usuario = []
    col_l1, col_l2, col_l3 = st.columns(3)
    for i, atleta in enumerate(atletas_cadastrados):
        col_dest = col_l1 if i % 3 == 0 else (col_l2 if i % 3 == 1 else col_l3)
        with col_dest:
            is_presente = st.checkbox(f"**{atleta['Nome']}** ({atleta['Posicao']} - Nv {atleta['Nivel']})", value=True, key=f"atleta_{i}")
            if is_presente:
                presencoes_usuario.append(atleta)

    st.divider()

    if 'sorteio_gerado' not in st.session_state:
        st.session_state.sorteio_gerado = False
    if 'seed_aleatorio' not in st.session_state:
        st.session_state.seed_aleatorio = 0

    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("🎲 Gerar Sorteio com os Presentes", type="primary", use_container_width=True):
            st.session_state.sorteio_gerado = True
            st.session_state.seed_aleatorio = random.randint(1, 10000)
    with col_btn2:
        if st.button("🔄 Refazer Sorteio (Novo Embaralhamento)", use_container_width=True):
            st.session_state.sorteio_gerado = True
            st.session_state.seed_aleatorio = random.randint(1, 10000)

    if st.session_state.sorteio_gerado:
        linha = [p for p in presencoes_usuario if p['Posicao'] != 'Goleiro']
        goleiros_presentes = [p for p in presencoes_usuario if p['Posicao'] == 'Goleiro']
        
        st.success(f"Atletas presentes na chamada: **{len(presencoes_usuario)}** (Goleiros: {len(goleiros_presentes)} | Linha: {len(linha)})")
        
        if len(linha) < 16:
            st.warning("⚠️ O número de jogadores de linha selecionados é menor que 16. Selecione mais atletas para formar 4 times completos.")
        else:
            rng = random.Random(st.session_state.seed_aleatorio)
            
            zagueiros = sorted([p for p in linha if p['Posicao'] == 'Zagueiro'], key=lambda x: (x['Nivel'], rng.random()), reverse=True)
            atacantes = sorted([p for p in linha if p['Posicao'] == 'Atacante'], key=lambda x: (x['Nivel'], rng.random()), reverse=True)
            meias = sorted([p for p in linha if p['Posicao'] == 'Meio-campo'], key=lambda x: (x['Nivel'], rng.random()), reverse=True)
            
            teams = [{"nome": "Time 1", "players": []}, 
                     {"nome": "Time 2", "players": []}, 
                     {"nome": "Time 3", "players": []},
                     {"nome": "Time 4", "players": []}]
            
            def distribuir(lista):
                direcao = 1
                idx = 0
                for p in lista:
                    teams[idx]['players'].append(p)
                    idx += direcao
                    if idx == len(teams):
                        direcao = -1
                        idx = len(teams) - 1
                    elif idx == -1:
                        direcao = 1
                        idx = 0
                        
            distribuir(zagueiros)
            distribuir(atacantes)
            distribuir(meias)
            
            st.markdown("### 👕 Equipes Sorteadas para a Rodada")
            col_t1, col_t2, col_t3, col_t4 = st.columns(4)
            cols = [col_t1, col_t2, col_t3, col_t4]
            
            for idx, t in enumerate(teams):
                t['players'].sort(key=lambda x: x['Posicao'], reverse=True)
                avg = sum(p['Nivel'] for p in t['players']) / len(t['players']) if t['players'] else 0
                with cols[idx]:
                    st.info(f"**{t['nome']}** \nMédia: **{avg:.2f}**")
                    for p in t['players']:
                        st.text(f"• {p['Nome']} ({p['Posicao'][:3]} | Nv {p['Nivel']})")
                        
            if goleiros_presentes:
                st.success(f"🛡️ **Goleiros presentes para revezar:** " + ", ".join([f"{g['Nome']} (Nv {g['Nivel']})" for g in goleiros_presentes]))

# ==========================================
# ABA 2: CLASSIFICAÇÃO, ARTILHARIA & RANKING ANUAL
# ==========================================
with tab2:
    st.title("🏆 Estatísticas & Ranking Acumulado (Anual)")
    st.markdown("Acompanhe o desempenho e a classificação acumulada ao longo da temporada.")
    st.divider()

    try:
        df_partidas_esp = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Partidas")
        df_eventos_esp = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Eventos")
        
        st.subheader("📊 Classificação Geral dos Times")
        times = pd.concat([df_partidas_esp['Equipe_A'], df_partidas_esp['Equipe_B']]).unique()
        classificacao = []
        
        for time in times:
            jogos_A = df_partidas_esp[df_partidas_esp['Equipe_A'] == time]
            jogos_B = df_partidas_esp[df_partidas_esp['Equipe_B'] == time]
            
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
            st.subheader("⚽ Artilharia Geral")
            gols = df_eventos_esp[df_eventos_esp['Evento'] == 'Gol']
            if not gols.empty:
                artilharia = gols.groupby('Nome').size().reset_index(name='Gols')
                artilharia = artilharia.sort_values(by='Gols', ascending=False).reset_index(drop=True)
                artilharia.index += 1
                st.dataframe(artilharia, use_container_width=True)
            else:
                st.info("Nenhum gol registrado.")
                
        with col2:
            st.subheader("👟 Ranking de Assistências")
            assistencias = df_eventos_esp[df_eventos_esp['Evento'] == 'Assistencia']
            if not assistencias.empty:
                ranking_assist = assistencias.groupby('Nome').size().reset_index(name='Assistências')
                ranking_assist = ranking_assist.sort_values(by='Assistências', ascending=False).reset_index(drop=True)
                ranking_assist.index += 1
                st.dataframe(ranking_assist, use_container_width=True)
            else:
                st.info("Nenhuma assistência registrada.")

        st.divider()
        col3, col4, col5 = st.columns(3)
        with col3:
            st.subheader("🛡️ Clean Sheets")
            cs = df_eventos_esp[df_eventos_esp['Evento'] == 'Clean Sheet']
            if not cs.empty:
                df_cs = cs.groupby('Nome').size().reset_index(name='Jogos Sem Sofrer Gols')
                df_cs = df_cs.sort_values(by='Jogos Sem Sofrer Gols', ascending=False).reset_index(drop=True)
                df_cs.index += 1
                st.dataframe(df_cs, use_container_width=True)
            else:
                st.info("Nenhum Clean Sheet.")

        with col4:
            st.subheader("🟨 Cartões")
            cartoes = df_eventos_esp[df_eventos_esp['Evento'].isin(['Cartão Amarelo', 'Cartão Vermelho'])]
            if not cartoes.empty:
                df_cartoes = cartoes.groupby(['Nome', 'Evento']).size().reset_index(name='Total')
                st.dataframe(df_cartoes, use_container_width=True)
            else:
                st.info("Nenhum cartão.")

        with col5:
            st.subheader("✅ Presença Anual")
            presenca = df_eventos_esp[df_eventos_esp['Evento'] == 'Presenca']
            if not presenca.empty:
                df_presenca = presenca.groupby('Nome').size().reset_index(name='Presenças')
                df_presenca = df_presenca.sort_values(by='Presenças', ascending=False).reset_index(drop=True)
                df_presenca.index += 1
                st.dataframe(df_presenca, use_container_width=True)
            else:
                st.info("Nenhuma presença.")

    except Exception as e:
        st.info("💡 Certifique-se de que a planilha 'banco_de_dados_baba.xlsx' está atualizada no repositório.")

# ==========================================
# ABA 3: SORTEIO DE TIMES
# ==========================================
with tab3:
    st.title("🎲 Gerador de Sorteio de Apoio")
    st.markdown("Ferramenta de apoio para divisão de times caso queira testar formações.")
    st.info("💡 A lista oficial de chamada interativa agora fica na **Aba 1 (Rodada de Domingo)**!")

# ==========================================
# ABA 4: CONTROLE FINANCEIRO
# ==========================================
with tab4:
    st.title("💰 Controle Financeiro - Grupo Irmandade")
    st.markdown("Acompanhamento consolidado de receitas, fluxo de caixa e inadimplência.")
    st.divider()

    try:
        df_fluxo = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Fluxo_de_Caixa")
        df_mensalidades = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Lançamentos_Mensalidades")
        
        total_entradas = df_fluxo[df_fluxo['Tipo'] == 'Entrada']['Valor'].sum()
        total_saidas = df_fluxo[df_fluxo['Tipo'] == 'Saída']['Valor'].sum()
        saldo_caixa = total_entradas - total_saidas
        
        status_associados = df_mensalidades.groupby('Associado').agg({
            'Valor Devido': 'sum',
            'Valor Pago': 'sum'
        }).reset_index()
        status_associados['Saldo Devedor'] = status_associados['Valor Devido'] - status_associados['Valor Pago']
        total_em_atraso = status_associados[status_associados['Saldo Devedor'] > 0]['Saldo Devedor'].sum()
        
        col_m1, col_m2, col_m3, col_m4 = st.columns(4)
        col_m1.metric("Entradas Realizadas", f"R$ {total_entradas:,.2f}")
        col_m2.metric("A Arrecadar (Atrasos)", f"R$ {total_em_atraso:,.2f}")
        col_m3.metric("Total Saídas (Custos)", f"R$ {total_saidas:,.2f}")
        col_m4.metric("Saldo em Caixa", f"R$ {saldo_caixa:,.2f}")
        
        st.divider()
        
        st.subheader("💵 Detalhamento das Receitas (Entradas)")
        entradas_df = df_fluxo[df_fluxo['Tipo'] == 'Entrada']
        
        def categorizar_receita(row):
            desc = str(row['Descrição']).lower()
            cat = str(row['Categoria']).lower()
            if 'mensalidade' in desc or 'mensalidade' in cat:
                return 'Mensalidades (R$ 40)'
            elif 'convidado' in desc or 'diaria' in desc or 'diarista' in cat:
                return 'Convidados / Diaristas (R$ 15)'
            else:
                return 'Outras Receitas (Rifas, Doações, Ações)'
                
        entradas_df['Tipo_Receita'] = entradas_df.apply(categorizar_receita, axis=1)
        receitas_resumo = entradas_df.groupby('Tipo_Receita')['Valor'].sum().reset_index()
        receitas_resumo.columns = ['Tipo de Receita', 'Valor Total (R$)']
        st.dataframe(receitas_resumo, use_container_width=True)
        
        st.divider()
        
        st.subheader("📉 Custos por Categoria (Saídas)")
        saidas_df = df_fluxo[df_fluxo['Tipo'] == 'Saída']
        custos_categoria = saidas_df.groupby('Categoria')['Valor'].sum().reset_index()
        custos_categoria.columns = ['Categoria', 'Valor Total (R$)']
        st.dataframe(custos_categoria, use_container_width=True)
        
        st.divider()
        
        st.subheader("👥 Status Financeiro dos Associados")
        status_associados['Status'] = status_associados['Saldo Devedor'].apply(lambda x: 'Em Dia 🟢' if x <= 0 else 'Pendente 🔴')
        
        col_a1, col_a2 = st.columns(2)
        
        with col_a1:
            st.markdown(f"#### 🔴 Pendências (Total: R$ {total_em_atraso:,.2f})")
            pendentes = status_associados[status_associados['Status'] == 'Pendente 🔴'].copy()
            if not pendentes.empty:
                tabela_pendentes = pendentes[['Associado', 'Saldo Devedor']].rename(columns={'Saldo Devedor': 'Valor a Pagar (R$)'})
                st.dataframe(tabela_pendentes, use_container_width=True)
            else:
                st.success("Nenhum associado com pendência!")
                
        with col_a2:
            st.markdown("#### 🟢 Associados em Dia")
            em_dia = status_associados[status_associados['Status'] == 'Em Dia 🟢'].copy()
            if not em_dia.empty:
                tabela_em_dia = em_dia[['Associado']].copy()
                tabela_em_dia['Situação'] = 'Em Dia 🟢'
                st.dataframe(tabela_em_dia, use_container_width=True)
            else:
                st.info("Nenhum associado em dia registrado.")
                
        st.divider()
        st.subheader("📋 Histórico Completo do Fluxo de Caixa")
        st.dataframe(df_fluxo, use_container_width=True)

    except Exception as e:
        st.error(f"Erro ao carregar dados financeiros: {e}")