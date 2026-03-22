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
const producaoRoutes = require('./src/routes/producaoRoutes');
const { testConnection } = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON, formularios simples e arquivos publicos.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rotas HTML das paginas administrativas.
app.get('/', (req, res) => {
  res.redirect('/pagina-submontagens');
});

app.get('/pagina-pecas', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'pecas.html'));
});

app.get('/pagina-submontagens', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'submontagens.html'));
});

app.get('/pagina-fornecedores', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'fornecedores.html'));
});

app.get('/pagina-maquinas', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'maquinas.html'));
});

app.get('/pagina-materias-primas', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'materias-primas.html'));
});

app.get('/pagina-estoque', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'estoque.html'));
});

app.get('/pagina-producao', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'producao.html'));
});

// Rotas REST dos modulos administrativos.
app.use('/api', pecaRoutes);
app.use('/api', submontagemRoutes);
app.use('/api', cadastroApoioRoutes);
app.use('/api', fornecedorRoutes);
app.use('/api', maquinaRoutes);
app.use('/api', materiaPrimaRoutes);
app.use('/api', estoqueRoutes);
app.use('/api', producaoRoutes);

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
