import streamlit as st
import pandas as pd
import datetime
import random

# Configuração da Página
st.set_page_config(
    page_title="Baba da Irmandade", 
    layout="wide", 
    page_icon="⚽"
)

# Design System & CSS Otimizado para Mobile e Desktop (Contraste perfeito)
st.markdown("""
    <style>
        .stApp {
            background-color: #f8fafc;
            color: #1e293b;
        }
        h1, h2, h3, h4, p, span, label {
            color: #1e293b !important;
        }
        div[data-testid="metric-container"] {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 14px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            margin-bottom: 8px;
        }
        div[data-testid="metric-container"] label {
            color: #475569 !important;
            font-weight: 700;
            font-size: 0.8rem;
        }
        div[data-testid="metric-container"] [data-testid="stMetricValue"] {
            color: #0f172a !important;
            font-weight: 800;
            font-size: 1.3rem;
        }
        .stTabs [data-baseweb="tab-list"] {
            gap: 4px;
            background-color: #ffffff;
            padding: 6px;
            border-radius: 10px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.05);
            overflow-x: auto;
            flex-wrap: nowrap;
        }
        .stTabs [data-baseweb="tab"] {
            background-color: #f1f5f9;
            border-radius: 6px;
            padding: 6px 12px;
            font-weight: 600;
            font-size: 0.8rem;
            color: #475569 !important;
            border: none;
            white-space: nowrap;
        }
        .stTabs [aria-selected="true"] {
            background: #0f172a !important;
            color: #ffffff !important;
        }
        .stTabs [aria-selected="true"] * {
            color: #ffffff !important;
        }
        .stButton>button {
            background: #2563eb;
            color: white;
            border-radius: 8px;
            font-weight: 700;
            padding: 0.6rem 1rem;
            width: 100%;
            border: none;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
            font-size: 0.9rem;
        }
        .stButton>button:hover {
            background: #1d4ed8;
            color: white;
        }
        .stCheckbox {
            background-color: #ffffff;
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            margin-bottom: 4px;
        }
        .stDataFrame {
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
            background-color: white;
        }
    </style>
""", unsafe_allow_html=True)

# Abas Principais (Agora com Presença, Sorteio, Partidas e Ranking integrados na Rodada)
tab1, tab2 = st.tabs([
    "⚽ Rodada (Presença, Sorteio, Partidas & Ranking)", 
    "💰 Controle Financeiro"
])

# ==========================================
# ABA 1: RODADA (Presença, Sorteio, Partidas & Ranking)
# ==========================================
with tab1:
    st.title("⚽ Gestão da Rodada de Domingo")
    st.markdown("Confirme a presença, gere o sorteio dos 4 times e acompanhe as estatísticas da rodada.")
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

    st.subheader("✅ Lista de Chamada / Presença")
    presencoes_usuario = []
    col_l1, col_l2 = st.columns(2)
    for i, atleta in enumerate(atletas_cadastrados):
        col_dest = col_l1 if i % 2 == 0 else col_l2
        with col_dest:
            is_presente = st.checkbox(f"{atleta['Nome']} ({atleta['Posicao'][:3]} | Nv {atleta['Nivel']})", value=True, key=f"atleta_{i}")
            if is_presente:
                presencoes_usuario.append(atleta)

    st.divider()

    if 'sorteio_gerado' not in st.session_state:
        st.session_state.sorteio_gerado = False
    if 'seed_aleatorio' not in st.session_state:
        st.session_state.seed_aleatorio = 0

    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("🎲 Gerar Sorteio", type="primary"):
            st.session_state.sorteio_gerado = True
            st.session_state.seed_aleatorio = random.randint(1, 10000)
    with col_btn2:
        if st.button("🔄 Refazer Sorteio"):
            st.session_state.sorteio_gerado = True
            st.session_state.seed_aleatorio = random.randint(1, 10000)

    if st.session_state.sorteio_gerado:
        linha = [p for p in presencoes_usuario if p['Posicao'] != 'Goleiro']
        goleiros_presentes = [p for p in presencoes_usuario if p['Posicao'] == 'Goleiro']
        
        st.success(f"Presentes: **{len(presencoes_usuario)}** (Goleiros: {len(goleiros_presentes)} | Linha: {len(linha)})")
        
        if len(linha) < 16:
            st.warning("⚠️ Menos de 16 jogadores de linha selecionados.")
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
            
            st.markdown("### 👕 Equipes Sorteadas")
            for t in teams:
                t['players'].sort(key=lambda x: x['Posicao'], reverse=True)
                avg = sum(p['Nivel'] for p in t['players']) / len(t['players']) if t['players'] else 0
                with st.expander(f"🟢 {t['nome']} (Média: {avg:.2f})", expanded=True):
                    for p in t['players']:
                        st.markdown(f"• **{p['Nome']}** — *{p['Posicao']}* (Nv {p['Nivel']})")
                        
            if goleiros_presentes:
                st.info(f"🛡️ **Goleiros:** " + ", ".join([f"{g['Nome']} (Nv {g['Nivel']})" for g in goleiros_presentes]))

    st.divider()
    st.subheader("📊 Classificação, Partidas & Ranking da Temporada")
    
    try:
        df_partidas_esp = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Partidas")
        df_eventos_esp = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Eventos")
        
        st.markdown("#### 🗓️ Confrontos e Classificação")
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
                "J": len(jogos_A) + len(jogos_B),
                "V": vitorias,
                "E": empates,
                "D": derrotas,
                "SG": gols_pro - gols_sofridos,
                "Pts": (vitorias * 3) + (empates * 1)
            })
            
        df_classificacao = pd.DataFrame(classificacao).sort_values(by=["Pts", "SG"], ascending=False).reset_index(drop=True)
        df_classificacao.index += 1
        st.dataframe(df_classificacao, use_container_width=True)

        st.markdown("#### ⚽ Artilharia")
        gols = df_eventos_esp[df_eventos_esp['Evento'] == 'Gol']
        if not gols.empty:
            artilharia = gols.groupby('Nome').size().reset_index(name='Gols')
            artilharia = artilharia.sort_values(by='Gols', ascending=False).reset_index(drop=True)
            artilharia.index += 1
            st.dataframe(artilharia, use_container_width=True)
        else:
            st.info("Nenhum gol registrado.")

        st.markdown("#### 👟 Assistências")
        assistencias = df_eventos_esp[df_eventos_esp['Evento'] == 'Assistencia']
        if not assistencias.empty:
            ranking_assist = assistencias.groupby('Nome').size().reset_index(name='Assistências')
            ranking_assist = ranking_assist.sort_values(by='Assistências', ascending=False).reset_index(drop=True)
            ranking_assist.index += 1
            st.dataframe(ranking_assist, use_container_width=True)
        else:
            st.info("Nenhuma assistência registrada.")

        st.markdown("#### 🛡️ Clean Sheets (Goleiros)")
        cs = df_eventos_esp[df_eventos_esp['Evento'] == 'Clean Sheet']
        if not cs.empty:
            df_cs = cs.groupby('Nome').size().reset_index(name='Clean Sheets')
            df_cs = df_cs.sort_values(by='Clean Sheets', ascending=False).reset_index(drop=True)
            df_cs.index += 1
            st.dataframe(df_cs, use_container_width=True)
        else:
            st.info("Nenhum Clean Sheet.")

        st.markdown("#### 🟨 Cartões")
        cartoes = df_eventos_esp[df_eventos_esp['Evento'].isin(['Cartão Amarelo', 'Cartão Vermelho', 'Cartao Azul', 'Cartao Vermelho', 'Cartão Azul'])]
        if not cartoes.empty:
            df_cartoes = cartoes.groupby(['Nome', 'Evento']).size().reset_index(name='Total')
            st.dataframe(df_cartoes, use_container_width=True)
        else:
            st.info("Nenhum cartão.")

    except Exception as e:
        st.info("💡 Certifique-se de que a planilha 'banco_de_dados_baba.xlsx' está atualizada no repositório.")

# ==========================================
# ABA 2: CONTROLE FINANCEIRO (Com Cartões Calculados)
# ==========================================
with tab2:
    st.title("💰 Controle Financeiro")
    st.markdown("Resumo de receitas, custos, multas de cartões e inadimplência.")
    st.divider()

    try:
        df_fluxo = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Fluxo_de_Caixa")
        df_mensalidades = pd.read_excel("Controle Grupo Irmandade.xlsx", sheet_name="Lançamentos_Mensalidades")
        
        # Leitura real dos cartões da planilha (Azul/Amarelo = R$ 5 | Vermelho = R$ 15)
        receita_cartoes = 0.0
        try:
            df_eventos_esp = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Eventos")
            azuis = len(df_eventos_esp[df_eventos_esp['Evento'].isin(['Cartão Amarelo', 'Cartao Azul', 'Azul', 'Cartão Azul'])])
            vermelhos = len(df_eventos_esp[df_eventos_esp['Evento'].isin(['Cartão Vermelho', 'Cartao Vermelho', 'Vermelho', 'Cartão Vermelho'])])
            receita_cartoes = (azuis * 5.0) + (vermelhos * 15.0)
        except:
            receita_cartoes = 0.0

        total_entradas_base = df_fluxo[df_fluxo['Tipo'] == 'Entrada']['Valor'].sum()
        total_entradas = total_entradas_base + receita_cartoes
        total_saidas = df_fluxo[df_fluxo['Tipo'] == 'Saída']['Valor'].sum()
        saldo_caixa = total_entradas - total_saidas
        
        status_associados = df_mensalidades.groupby('Associado').agg({
            'Valor Devido': 'sum',
            'Valor Pago': 'sum'
        }).reset_index()
        status_associados['Saldo Devedor'] = status_associados['Valor Devido'] - status_associados['Valor Pago']
        total_em_atraso = status_associados[status_associados['Saldo Devedor'] > 0]['Saldo Devedor'].sum()
        
        st.metric("Entradas Totais", f"R$ {total_entradas:,.2f}")
        st.metric("A Arrecadar (Atrasos)", f"R$ {total_em_atraso:,.2f}")
        st.metric("Total Saídas (Custos)", f"R$ {total_saidas:,.2f}")
        st.metric("Saldo em Caixa", f"R$ {saldo_caixa:,.2f}")
        
        st.divider()
        
        st.subheader("💵 Detalhamento de Receitas")
        entradas_df = df_fluxo[df_fluxo['Tipo'] == 'Entrada'].copy()
        
        def categorizar_receita(row):
            desc = str(row['Descrição']).lower()
            cat = str(row['Categoria']).lower()
            if 'mensalidade' in desc or 'mensalidade' in cat:
                return 'Mensalidades (R$ 40)'
            elif 'convidado' in desc or 'diaria' in desc or 'diarista' in cat:
                return 'Convidados (R$ 15)'
            else:
                return 'Outras Receitas'
                
        entradas_df['Tipo_Receita'] = entradas_df.apply(categorizar_receita, axis=1)
        receitas_resumo = entradas_df.groupby('Tipo_Receita')['Valor'].sum().reset_index()
        
        if receita_cartoes > 0:
            cartao_row = pd.DataFrame([{'Tipo de Receita': 'Multas Cartões (Azul R$5 | Vermelho R$15)', 'Valor Total (R$)': receita_cartoes}])
            receitas_resumo = pd.concat([receitas_resumo, cartao_row], ignore_index=True)

        receitas_resumo.columns = ['Categoria', 'Valor (R$)']
        st.dataframe(receitas_resumo, use_container_width=True)
        
        st.divider()
        
        st.subheader("📉 Custos (Saídas)")
        saidas_df = df_fluxo[df_fluxo['Tipo'] == 'Saída']
        custos_categoria = saidas_df.groupby('Categoria')['Valor'].sum().reset_index()
        custos_categoria.columns = ['Categoria', 'Valor (R$)']
        st.dataframe(custos_categoria, use_container_width=True)
        
        st.divider()
        
        st.subheader("👥 Status dos Associados")
        status_associados['Status'] = status_associados['Saldo Devedor'].apply(lambda x: 'Em Dia 🟢' if x <= 0 else 'Pendente 🔴')
        
        st.markdown(f"#### 🔴 Pendências (Total: R$ {total_em_atraso:,.2f})")
        pendentes = status_associados[status_associados['Status'] == 'Pendente 🔴'].copy()
        if not pendentes.empty:
            tabela_pendentes = pendentes[['Associado', 'Saldo Devedor']].rename(columns={'Saldo Devedor': 'A Pagar (R$)'})
            st.dataframe(tabela_pendentes, use_container_width=True)
        else:
            st.success("Nenhum associado com pendência!")
            
        st.markdown(f"#### 🟢 Em Dia")
        em_dia = status_associados[status_associados['Status'] == 'Em Dia 🟢'].copy()
        if not em_dia.empty:
            tabela_em_dia = em_dia[['Associado']].copy()
            tabela_em_dia['Situação'] = 'Em Dia 🟢'
            st.dataframe(tabela_em_dia, use_container_width=True)
        else:
            st.info("Nenhum associado em dia.")

    except Exception as e:
        st.error(f"Erro ao carregar dados financeiros: {e}")