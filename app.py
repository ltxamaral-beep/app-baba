import streamlit as st
import pandas as pd

# Configuração da Página
st.set_page_config(page_title="Estatísticas - Baba da Irmandade", layout="wide", page_icon="⚽")

# Cabeçalho Principal
st.title("🏆 Painel de Estatísticas - Baba da Irmandade")
st.markdown("Acompanhe em tempo real os resultados, artilheiros e a classificação do nosso baba!")
st.divider()

# Função para carregar os dados
@st.cache_data
def carregar_dados():
    df_atletas = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Atletas")
    df_partidas = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Partidas")
    df_eventos = pd.read_excel("banco_de_dados_baba.xlsx", sheet_name="Eventos")
    return df_atletas, df_partidas, df_eventos

try:
    df_atletas, df_partidas, df_eventos = carregar_dados()
    
    # --- TABELA DE CLASSIFICAÇÃO ---
    st.subheader("📊 Classificação Final (Pontos Corridos)")
    
    # Cálculo automático de pontos e saldo
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
    df_classificacao.index += 1  # Para o ranking começar no 1
    
    st.dataframe(df_classificacao, use_container_width=True)
    st.divider()

    # --- DESTAQUES INDIVIDUAIS ---
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

    # --- HISTÓRICO DE PARTIDAS ---
    st.subheader("🗓️ Últimos Confrontos")
    df_exibicao = df_partidas[['Data', 'Equipe_A', 'Gols_A', 'Gols_B', 'Equipe_B']].copy()
    df_exibicao.columns = ['Data', 'Time Mandante', 'Gols Mandante', 'Gols Visitante', 'Time Visitante']
    st.dataframe(df_exibicao, use_container_width=True)
    
except FileNotFoundError:
    st.error("⚠️ O arquivo 'banco_de_dados_baba.xlsx' não foi encontrado. Verifique se ele foi carregado no repositório.")
