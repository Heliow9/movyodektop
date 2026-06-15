window.addEventListener('DOMContentLoaded', () => {
  console.log('✅ PRELOAD WEBVIEW RODANDO!');

  const interval = setInterval(() => {
    const input = document.querySelector("div[aria-label='Digite uma mensagem'][contenteditable='true']");

    if (input && !document.querySelector('#meu-botao-custom')) {
      const botao = document.createElement('button');
      botao.id = 'meu-botao-custom';
      botao.textContent = '⚙️';
      botao.style.marginLeft = '10px';
      botao.style.cursor = 'pointer';
      botao.style.height = '40px';
      botao.style.border = 'none';
      botao.style.background = '#25D366';
      botao.style.borderRadius = '5px';
      botao.style.color = 'white';

      botao.onclick = () => {
        alert('🔥 Botão custom funcionando!');
      };

      input.parentElement.appendChild(botao);
      console.log('✅ Botão custom adicionado!');
      clearInterval(interval);
    }
  }, 1000);
});