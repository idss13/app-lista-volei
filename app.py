import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import text
from zoneinfo import ZoneInfo

# Fuso horário de Brasília
FUSO = ZoneInfo('America/Sao_Paulo')

st.set_page_config(page_title="Vôlei - Lista de Presença", page_icon="🏐")

# --- Conexão com o Banco de Dados ---
conn = st.connection("postgresql", type="sql")

# Inicialização das tabelas
def init_db():
    with conn.session as s:
        # Tabela atual
        s.execute(text("""
            CREATE TABLE IF NOT EXISTS jogadores (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                categoria VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        # Tabela de Histórico (NOVA)
        s.execute(text("""
            CREATE TABLE IF NOT EXISTS historico_jogadores (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                categoria VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                data_jogo DATE NOT NULL,
                arquivado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        # Tabela de Configuração
        s.execute(text("""
            CREATE TABLE IF NOT EXISTS config (
                id INT PRIMARY KEY,
                horario_limite VARCHAR(10),
                chave_pix VARCHAR(255),
                data_jogo VARCHAR(10)
            );
        """))
        
        try:
            s.execute(text("ALTER TABLE config ADD COLUMN data_jogo VARCHAR(10)"))
            hoje_str = datetime.now(FUSO).strftime("%Y-%m-%d")
            s.execute(text("UPDATE config SET data_jogo = :hj WHERE id = 1"), {"hj": hoje_str})
            s.commit()
        except Exception:
            s.rollback()

        count = s.execute(text("SELECT COUNT(*) FROM config")).scalar()
        if count == 0:
            hoje_str = datetime.now(FUSO).strftime("%Y-%m-%d")
            s.execute(text("INSERT INTO config (id, horario_limite, chave_pix, data_jogo) VALUES (1, '20:00', 'Sua chave PIX aqui', :hj)"), {"hj": hoje_str})
            s.commit()

init_db()

# --- Funções de Banco de Dados ---
def get_config():
    df = conn.query("SELECT * FROM config WHERE id = 1", ttl=0)
    return df.iloc[0]

def update_config(limite, pix, data_jogo):
    with conn.session as s:
        s.execute(text("UPDATE config SET horario_limite = :limite, chave_pix = :pix, data_jogo = :dt WHERE id = 1"), 
                  {"limite": limite, "pix": pix, "dt": data_jogo})
        s.commit()

def get_jogadores():
    return conn.query("SELECT * FROM jogadores ORDER BY criado_em ASC", ttl=0)

def adicionar_jogador(nome, categoria, status):
    with conn.session as s:
        s.execute(text("INSERT INTO jogadores (nome, categoria, status) VALUES (:nome, :categoria, :status)"),
                  {"nome": nome, "categoria": categoria, "status": status})
        s.commit()

def remover_jogador(jogador_id, categoria, era_oficial):
    with conn.session as s:
        s.execute(text("DELETE FROM jogadores WHERE id = :id"), {"id": int(jogador_id)})
        
        if era_oficial:
            espera = s.execute(text("""
                SELECT id, nome FROM jogadores 
                WHERE categoria = :cat AND status = 'espera' 
                ORDER BY criado_em ASC LIMIT 1
            """), {"cat": categoria}).fetchone()
            
            if espera:
                s.execute(text("UPDATE jogadores SET status = 'oficial' WHERE id = :id"), {"id": espera[0]})
                st.toast(f"🔄 {espera[1]} subiu para a lista oficial de {categoria}s!")
        s.commit()

def arquivar_e_limpar_lista(data_do_jogo_str):
    with conn.session as s:
        # 1. Copia todos os jogadores atuais para a tabela de histórico com a data do jogo
        s.execute(text("""
            INSERT INTO historico_jogadores (nome, categoria, status, data_jogo)
            SELECT nome, categoria, status, :dt FROM jogadores
        """), {"dt": data_do_jogo_str})
        
        # 2. Limpa a lista atual para a próxima semana
        s.execute(text("DELETE FROM jogadores"))
        s.commit()

def get_datas_historico():
    df = conn.query("SELECT DISTINCT data_jogo FROM historico_jogadores ORDER BY data_jogo DESC", ttl=0)
    # Retorna uma lista de strings no formato YYYY-MM-DD
    return [dt.strftime("%Y-%m-%d") for dt in df['data_jogo']] if not df.empty else []

def get_historico_por_data(data_jogo):
    return conn.query(f"SELECT * FROM historico_jogadores WHERE data_jogo = '{data_jogo}' ORDER BY status, categoria, arquivado_em ASC", ttl=0)

# --- Lógica da Interface ---
VAGAS = {'Levantador': 3, 'Mulher': 3, 'Homem': 12}
config_atual = get_config()

# --- VERIFICAÇÃO DE RENOVAÇÃO AUTOMÁTICA ---
agora = datetime.now(FUSO)
hoje_data = agora.date()
data_do_jogo = datetime.strptime(config_atual['data_jogo'], "%Y-%m-%d").date()

# Se o dia de hoje for MAIOR que o dia do jogo (já passou da meia-noite)
if hoje_data > data_do_jogo:
    # Salva no histórico e limpa a tabela
    arquivar_e_limpar_lista(config_atual['data_jogo'])
    
    # Atualiza a data do jogo automaticamente (+7 dias)
    nova_data_jogo = data_do_jogo + timedelta(days=7)
    if nova_data_jogo < hoje_data:
        nova_data_jogo = hoje_data

    update_config(config_atual['horario_limite'], config_atual['chave_pix'], nova_data_jogo.strftime("%Y-%m-%d"))
    st.toast("🧹 Lista da semana anterior foi arquivada no histórico!")
    config_atual = get_config()
    data_do_jogo = nova_data_jogo

# Autenticação do Admin
if 'admin_logado' not in st.session_state:
    st.session_state.admin_logado = False

st.sidebar.title("⚙️ Área do Organizador")
if not st.session_state.admin_logado:
    senha = st.sidebar.text_input("Senha de Acesso", type="password")
    if st.sidebar.button("Entrar"):
        if senha == "admin123":
            st.session_state.admin_logado = True
            st.rerun()
        else:
            st.sidebar.error("Senha incorreta!")
else:
    st.sidebar.success("Modo Organizador Ativo")
    nova_data = st.sidebar.date_input("Data do Jogo", value=data_do_jogo)
    novo_limite = st.sidebar.text_input("Horário Limite (HH:MM)", value=config_atual['horario_limite'])
    novo_pix = st.sidebar.text_input("Chave PIX", value=config_atual['chave_pix'])
    
    if st.sidebar.button("Salvar Configurações"):
        update_config(novo_limite, novo_pix, nova_data.strftime("%Y-%m-%d"))
        st.sidebar.success("Salvo com sucesso!")
        st.rerun()
        
    if st.sidebar.button("Sair"):
        st.session_state.admin_logado = False
        st.rerun()

st.title("🏐 Lista de Presença - Vôlei")
st.markdown(f"**Data do Jogo:** {data_do_jogo.strftime('%d/%m/%Y')} | **Inscrições até:** {config_atual['horario_limite']}")

# --- Validação de Horário ---
agora_str = agora.strftime("%H:%M")
passou_horario = (hoje_data == data_do_jogo and agora_str >= config_atual['horario_limite'])

if passou_horario:
    st.error(f"⏳ Inscrições encerradas! O horário limite era {config_atual['horario_limite']}.")
else:
    st.subheader("Insira seu nome na lista")
    with st.form("form_inscricao", clear_on_submit=True):
        col1, col2 = st.columns([2, 1])
        with col1:
            nome_input = st.text_input("Nome do Jogador")
        with col2:
            categoria_input = st.selectbox("Posição/Categoria", ["Homem", "Mulher", "Levantador"])
        
        if st.form_submit_button("Adicionar Nome"):
            if not nome_input.strip():
                st.warning("Digite um nome válido.")
            else:
                df_jogadores = get_jogadores()
                oficiais_cat = df_jogadores[(df_jogadores['categoria'] == categoria_input) & (df_jogadores['status'] == 'oficial')]
                
                if len(oficiais_cat) < VAGAS[categoria_input]:
                    adicionar_jogador(nome_input.strip(), categoria_input, "oficial")
                    st.success(f"✅ Confirmado na lista oficial!")
                else:
                    adicionar_jogador(nome_input.strip(), categoria_input, "espera")
                    st.warning(f"⚠️ Vagas esgotadas. Adicionado na fila de espera!")
                st.rerun()

st.divider()

# --- Exibição das Listas ---
df_todos = get_jogadores()
st.subheader("📋 Lista Oficial de Jogadores")

total_oficiais = len(df_todos[df_todos['status'] == 'oficial'])
st.write(f"**Total na quadra:** {total_oficiais}/18")

for cat in ['Levantador', 'Mulher', 'Homem']:
    df_cat_oficial = df_todos[(df_todos['categoria'] == cat) & (df_todos['status'] == 'oficial')]
    st.markdown(f"#### {cat}s ({len(df_cat_oficial)}/{VAGAS[cat]})")
    
    if df_cat_oficial.empty:
        st.caption("Nenhum jogador nesta categoria ainda.")
        
    for _, row in df_cat_oficial.iterrows():
        col_nome, col_btn = st.columns([0.85, 0.15])
        col_nome.write(f"👤 {row['nome']}")
        if col_btn.button("Remover", key=f"rem_oficial_{row['id']}"):
            remover_jogador(row['id'], cat, era_oficial=True)
            st.rerun()

st.divider()

df_espera = df_todos[df_todos['status'] == 'espera']
if not df_espera.empty:
    st.subheader("⏱️ Lista de Espera")
    for cat in ['Levantador', 'Mulher', 'Homem']:
        df_cat_espera = df_espera[df_espera['categoria'] == cat]
        if not df_cat_espera.empty:
            st.write(f"**{cat}s:**")
            for i, row in enumerate(df_cat_espera.itertuples()):
                col_esp_nome, col_esp_btn = st.columns([0.85, 0.15])
                col_esp_nome.write(f"{i+1}º - {row.nome}")
                if col_esp_btn.button("Sair", key=f"rem_espera_{row.id}"):
                    remover_jogador(row.id, cat, era_oficial=False)
                    st.rerun()
    st.divider()

st.subheader("💳 Pagamento da Quadra")
st.info("Para garantir sua vaga, realize o pagamento via PIX.")
st.write("**Copie a chave abaixo:**")
st.code(config_atual['chave_pix'], language="text")

# --- ÁREA EXCLUSIVA: HISTÓRICO DE JOGOS ---
if st.session_state.admin_logado:
    st.divider()
    st.subheader("📚 Histórico de Partidas Anteriores")
    datas_disponiveis = get_datas_historico()
    
    if not datas_disponiveis:
        st.info("Nenhum histórico arquivado ainda. O histórico aparecerá aqui quando um jogo for concluído.")
    else:
        data_selecionada = st.selectbox("Selecione a data do jogo", datas_disponiveis)
        df_historico = get_historico_por_data(data_selecionada)
        
        # Formata a exibição para o admin usando pandas
        st.dataframe(
            df_historico[['nome', 'categoria', 'status']],
            column_config={
                "nome": "Nome do Jogador",
                "categoria": "Posição",
                "status": "Status Final"
            },
            hide_index=True,
            use_container_width=True
        )