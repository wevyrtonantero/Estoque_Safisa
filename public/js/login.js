document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const nextInput = document.getElementById('login-next');
  const submitButton = document.getElementById('login-submit');
  const messageBox = document.getElementById('login-message');

  if (!form || !usernameInput || !passwordInput || !nextInput || !submitButton || !messageBox) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    nextInput.value = next;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const login = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!login || !password) {
      showMessage('Informe login e senha.', 'error');
      if (!login) {
        usernameInput.focus();
      } else {
        passwordInput.focus();
      }
      return;
    }

    submitButton.disabled = true;
    showMessage('', '');
    messageBox.classList.add('hidden');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          login,
          password,
          next: nextInput.value
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Nao foi possivel entrar.');
      }

      window.location.href = result.redirectTo || '/pagina-acesso';
    } catch (error) {
      showMessage(error.message, 'error');
      submitButton.disabled = false;
      passwordInput.select();
    }
  });

  function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = type ? `message ${type}` : 'message';
    if (!text) {
      messageBox.classList.add('hidden');
    } else {
      messageBox.classList.remove('hidden');
    }
  }
});
