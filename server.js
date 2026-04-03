// Servidor principal do modulo administrativo SAFISA.
const express = require('express');
const path = require('path');

const pecaRoutes = require('./src/routes/pecaRoutes');
const submontagemRoutes = require('./src/routes/submontagemRoutes');
const cadastroApoioRoutes = require('./src/routes/cadastroApoioRoutes');
const fornecedorRoutes = require('./src/routes/fornecedorRoutes');
const maquinaRoutes = require('./src/routes/maquinaRoutes');
const materiaPrimaRoutes = require('./src/routes/materiaPrimaRoutes');
const estoqueRoutes = require('./src/routes/estoqueRoutes');
const estoqueMateriaPrimaRoutes = require('./src/routes/estoqueMateriaPrimaRoutes');
const producaoRoutes = require('./src/routes/producaoRoutes');
const terceirizacaoRemessaRoutes = require('./src/routes/terceirizacaoRemessaRoutes');
const tratamentoExternoRoutes = require('./src/routes/tratamentoExternoRoutes');
const solicitacaoEstoqueRoutes = require('./src/routes/solicitacaoEstoqueRoutes');
const solicitacaoProducaoRoutes = require('./src/routes/solicitacaoProducaoRoutes');
const painelRoutes = require('./src/routes/painelRoutes');
const { testConnection } = require('./database/connection');
const { appConfig } = require('./database/config');

const app = express();
const PORT = appConfig.port;
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0'
};

app.disable('etag');

function sendView(res, fileName) {
  res.sendFile(path.join(__dirname, 'views', fileName), {
    headers: NO_CACHE_HEADERS
  });
}

// Middleware para JSON, formularios simples e arquivos publicos.
app.use((req, res, next) => {
  Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => res.set(key, value));
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders(res) {
    Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => res.set(key, value));
  }
}));

// Rotas HTML das paginas administrativas.
app.get('/', (req, res) => {
  res.redirect('/pagina-inicial');
});

app.get('/pagina-inicial', (req, res) => {
  sendView(res, 'portal-inicial.html');
});

app.get('/pagina-acesso', (req, res) => {
  sendView(res, 'portal-acesso.html');
});

app.get('/pagina-operacao', (req, res) => {
  sendView(res, 'portal-operacao.html');
});

app.get('/pagina-adm', (req, res) => {
  sendView(res, 'portal-adm.html');
});

app.get('/pagina-pecas', (req, res) => {
  sendView(res, 'pecas.html');
});

app.get('/pagina-dashboard', (req, res) => {
  sendView(res, 'dashboard-executivo.html');
});

app.get('/pagina-diretoria', (req, res) => {
  res.redirect('/pagina-dashboard');
});

app.get('/pagina-almoxarifado', (req, res) => {
  sendView(res, 'dashboard.html');
});

app.get('/pagina-relatorios', (req, res) => {
  res.redirect('/pagina-dashboard');
});

app.get('/pagina-simulacao-montagem', (req, res) => {
  sendView(res, 'simulacao-montagem.html');
});

app.get('/pagina-montagem', (req, res) => {
  sendView(res, 'montagem.html');
});

app.get('/pagina-expedicao', (req, res) => {
  sendView(res, 'expedicao.html');
});

app.get('/pagina-submontagens', (req, res) => {
  sendView(res, 'submontagens.html');
});

app.get('/pagina-fornecedores', (req, res) => {
  sendView(res, 'fornecedores.html');
});

app.get('/pagina-maquinas', (req, res) => {
  sendView(res, 'maquinas.html');
});

app.get('/pagina-materias-primas', (req, res) => {
  sendView(res, 'materias-primas.html');
});

app.get('/pagina-estoque', (req, res) => {
  sendView(res, 'estoque.html');
});

app.get('/pagina-producao', (req, res) => {
  sendView(res, 'producao.html');
});

app.get('/pagina-estoque-materias-primas', (req, res) => {
  sendView(res, 'estoque-materias-primas.html');
});

app.get('/pagina-tratamento-externo', (req, res) => {
  sendView(res, 'tratamento-externo.html');
});

app.get('/pagina-remessas-terceiros', (req, res) => {
  sendView(res, 'remessas-terceiros.html');
});

// Rotas REST dos modulos administrativos.
app.use('/api', pecaRoutes);
app.use('/api', submontagemRoutes);
app.use('/api', cadastroApoioRoutes);
app.use('/api', fornecedorRoutes);
app.use('/api', maquinaRoutes);
app.use('/api', materiaPrimaRoutes);
app.use('/api', estoqueRoutes);
app.use('/api', estoqueMateriaPrimaRoutes);
app.use('/api', producaoRoutes);
app.use('/api', terceirizacaoRemessaRoutes);
app.use('/api', tratamentoExternoRoutes);
app.use('/api', solicitacaoEstoqueRoutes);
app.use('/api', solicitacaoProducaoRoutes);
app.use('/api', painelRoutes);

// Resposta padrao para qualquer rota nao mapeada.
app.use((req, res) => {
  res.status(404).json({ message: 'Rota nao encontrada.' });
});

// Tratamento central para erros nao previstos do servidor.
app.use((error, req, res, next) => {
  console.error('Erro nao tratado no servidor:', error);
  res.status(500).json({ message: 'Erro interno do servidor.' });
});

app.listen(PORT, async () => {
  console.log(`Servidor SAFISA rodando em http://localhost:${PORT}`);

  try {
    await testConnection();
  } catch (error) {
    console.error('Nao foi possivel validar a conexao com o MySQL:', error.message);
  }
});
