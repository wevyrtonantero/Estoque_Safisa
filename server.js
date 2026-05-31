// Servidor principal do modulo administrativo SAFISA.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');

const pecaRoutes = require('./src/routes/pecaRoutes');
const submontagemRoutes = require('./src/routes/submontagemRoutes');
const cadastroApoioRoutes = require('./src/routes/cadastroApoioRoutes');
const fornecedorRoutes = require('./src/routes/fornecedorRoutes');
const maquinaRoutes = require('./src/routes/maquinaRoutes');
const materiaPrimaRoutes = require('./src/routes/materiaPrimaRoutes');
const estoqueRoutes = require('./src/routes/estoqueRoutes');
const estoqueMateriaPrimaRoutes = require('./src/routes/estoqueMateriaPrimaRoutes');
const calculadoraMateriaPrimaRoutes = require('./src/routes/calculadoraMateriaPrimaRoutes');
const producaoRoutes = require('./src/routes/producaoRoutes');
const terceirizacaoRemessaRoutes = require('./src/routes/terceirizacaoRemessaRoutes');
const tratamentoExternoRoutes = require('./src/routes/tratamentoExternoRoutes');
const estoqueEspecialRoutes = require('./src/routes/estoqueEspecialRoutes');
const consultaEstoqueRoutes = require('./src/routes/consultaEstoqueRoutes');
const solicitacaoEstoqueRoutes = require('./src/routes/solicitacaoEstoqueRoutes');
const solicitacaoProducaoRoutes = require('./src/routes/solicitacaoProducaoRoutes');
const painelRoutes = require('./src/routes/painelRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const etiquetaRoutes = require('./src/routes/etiquetaRoutes');
const auditLogRoutes = require('./src/routes/auditLogRoutes');
const authRoutes = require('./src/routes/authRoutes');
const composicaoVendaRoutes = require('./src/routes/composicaoVendaRoutes');
const gerenciamentoServosRoutes = require('./src/routes/gerenciamentoServosRoutes');
const submontagemSerialRoutes = require('./src/routes/submontagemSerialRoutes');
const pedidoExpedicaoRoutes = require('./src/routes/pedidoExpedicaoRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const notificacaoRoutes = require('./src/routes/notificacaoRoutes');
const AuthController = require('./src/controllers/AuthController');
const UsuarioModel = require('./src/models/UsuarioModel');
const AuditLogModel = require('./src/models/AuditLogModel');
const ComposicaoVendaModel = require('./src/models/ComposicaoVendaModel');
const ExpedicaoSaidaModel = require('./src/models/ExpedicaoSaidaModel');
const ProducaoModel = require('./src/models/ProducaoModel');
const SubmontagemSerialModel = require('./src/models/SubmontagemSerialModel');
const PedidoExpedicaoModel = require('./src/models/PedidoExpedicaoModel');
const SolicitacaoEstoqueModel = require('./src/models/SolicitacaoEstoqueModel');
const EtiquetaModel = require('./src/models/EtiquetaModel');
const EtiquetaHistoricoModel = require('./src/models/EtiquetaHistoricoModel');
const ChatModel = require('./src/models/ChatModel');
const NotificacaoModel = require('./src/models/NotificacaoModel');
const { attachAuthContext, requirePageRoles } = require('./src/middleware/authMiddleware');
const { ALL_ROLES, ADMIN_READ_ROLES, OPERATION_READ_ROLES, SUPERADMIN_ONLY_ROLES, STOCK_READ_ROLES } = require('./src/security/roles');
const { testConnection } = require('./database/connection');
const { appConfig } = require('./database/config');

const app = express();
const PORT = appConfig.port;
const SESSION_SECRET = appConfig.sessionSecret || crypto.randomBytes(32).toString('hex');
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
app.use(session({
  name: appConfig.sessionCookieName,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders(res) {
    Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => res.set(key, value));
  }
}));
app.use('/kits', express.static(path.join(__dirname, 'kits'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders(res) {
    Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => res.set(key, value));
  }
}));
app.use(attachAuthContext);

// Rotas HTML das paginas do sistema.
app.get('/', (req, res) => {
  res.redirect('/pagina-inicial');
});

app.get('/pagina-inicial', (req, res) => {
  sendView(res, 'portal-inicial.html');
});

app.get('/pagina-login', (req, res) => {
  if (!req.authEnabled || req.currentUser) {
    res.redirect('/pagina-acesso');
    return;
  }

  sendView(res, 'login.html');
});

app.get('/sair', AuthController.logoutRedirect);

app.get('/pagina-acesso', requirePageRoles(ALL_ROLES), (req, res) => {
  sendView(res, 'portal-acesso.html');
});

app.get('/pagina-operacao', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'portal-operacao.html');
});

app.get('/pagina-adm', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'portal-adm.html');
});

app.get('/pagina-etiquetas', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'etiquetas.html');
});

app.get('/pagina-composicoes-venda', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'composicoes-venda.html');
});

app.get('/pagina-pecas', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'pecas.html');
});

app.get('/pagina-dashboard', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'dashboard-executivo.html');
});

app.get('/pagina-auditoria', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'auditoria.html');
});

app.get('/pagina-diretoria', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  res.redirect('/pagina-dashboard');
});

app.get('/pagina-almoxarifado', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'dashboard.html');
});

app.get('/pagina-relatorios', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  res.redirect('/pagina-dashboard');
});

app.get('/pagina-simulacao-montagem', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'simulacao-montagem.html');
});

app.get('/pagina-montagem', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'montagem.html');
});

app.get('/pagina-gerenciamento-servos', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'gerenciamento-servos.html');
});

app.get('/pagina-historico-numeros-serie', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'historico-numeros-serie.html');
});

app.get('/pagina-expedicao', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'expedicao.html');
});

app.get('/pagina-gerenciamento-pedidos', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'gerenciamento-pedidos.html');
});

app.get('/pagina-saidas-expedicao', requirePageRoles(STOCK_READ_ROLES), (req, res) => {
  sendView(res, 'relatorio-saidas-expedicao.html');
});

app.get('/pagina-submontagens', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'submontagens.html');
});

app.get('/pagina-fornecedores', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'fornecedores.html');
});

app.get('/pagina-maquinas', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'maquinas.html');
});

app.get('/pagina-usuarios', requirePageRoles(SUPERADMIN_ONLY_ROLES), (req, res) => {
  sendView(res, 'usuarios.html');
});

app.get('/pagina-materias-primas', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'materias-primas.html');
});

app.get('/pagina-estoque', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'estoque.html');
});

app.get('/pagina-producao', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'producao.html');
});

app.get('/pagina-estoque-materias-primas', requirePageRoles(STOCK_READ_ROLES), (req, res) => {
  sendView(res, 'estoque-materias-primas.html');
});

app.get('/pagina-tratamento-externo', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'tratamento-externo.html');
});

app.get('/pagina-consulta-estoques', requirePageRoles(STOCK_READ_ROLES), (req, res) => {
  sendView(res, 'consulta-estoques.html');
});

app.get('/pagina-retrabalho', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'retrabalho.html');
});

app.get('/pagina-pecas-inacabadas', requirePageRoles(OPERATION_READ_ROLES), (req, res) => {
  sendView(res, 'pecas-inacabadas.html');
});

app.get('/pagina-remessas-terceiros', requirePageRoles(ADMIN_READ_ROLES), (req, res) => {
  sendView(res, 'remessas-terceiros.html');
});

// Rotas REST do sistema.
app.use('/api', authRoutes);
app.use('/api', pecaRoutes);
app.use('/api', submontagemRoutes);
app.use('/api', cadastroApoioRoutes);
app.use('/api', fornecedorRoutes);
app.use('/api', maquinaRoutes);
app.use('/api', materiaPrimaRoutes);
app.use('/api', estoqueRoutes);
app.use('/api', estoqueMateriaPrimaRoutes);
app.use('/api', calculadoraMateriaPrimaRoutes);
app.use('/api', producaoRoutes);
app.use('/api', terceirizacaoRemessaRoutes);
app.use('/api', tratamentoExternoRoutes);
app.use('/api', estoqueEspecialRoutes);
app.use('/api', consultaEstoqueRoutes);
app.use('/api', solicitacaoEstoqueRoutes);
app.use('/api', solicitacaoProducaoRoutes);
app.use('/api', painelRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', etiquetaRoutes);
app.use('/api', auditLogRoutes);
app.use('/api', composicaoVendaRoutes);
app.use('/api', gerenciamentoServosRoutes);
app.use('/api', submontagemSerialRoutes);
app.use('/api', pedidoExpedicaoRoutes);
app.use('/api', chatRoutes);
app.use('/api', notificacaoRoutes);
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
    await UsuarioModel.ensureSchema();
    await AuditLogModel.ensureSchema();
    await ComposicaoVendaModel.ensureSchema();
    await ExpedicaoSaidaModel.ensureSchema();
    await ProducaoModel.ensureSchema();
    await SubmontagemSerialModel.ensureSchema();
    await PedidoExpedicaoModel.ensureSchema();
    await SolicitacaoEstoqueModel.ensureSchema();
    await EtiquetaModel.ensureSchema();
    await EtiquetaHistoricoModel.ensureSchema();
    await ChatModel.ensureSchema();
    await NotificacaoModel.ensureSchema();
  } catch (error) {
    console.error('Nao foi possivel validar a conexao com o MySQL:', error.message);
  }
});
