(function initSafisaSync(global) {
  const STORAGE_KEY = 'safisa:sync:event';
  const CHANNEL_NAME = 'safisa-sync';
  const SOURCE_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const listeners = new Map();
  const channel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(CHANNEL_NAME)
    : null;

  function addListener(topic, handler) {
    if (!listeners.has(topic)) {
      listeners.set(topic, new Set());
    }

    listeners.get(topic).add(handler);

    return () => {
      const topicListeners = listeners.get(topic);
      if (!topicListeners) {
        return;
      }

      topicListeners.delete(handler);
      if (!topicListeners.size) {
        listeners.delete(topic);
      }
    };
  }

  function emitLocal(event) {
    const topics = Array.isArray(event.topics) ? event.topics : [];

    topics.forEach((topic) => {
      const topicListeners = listeners.get(topic);
      if (!topicListeners) {
        return;
      }

      topicListeners.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Falha ao processar evento de sincronizacao (${topic}):`, error);
        }
      });
    });
  }

  function handleIncoming(event) {
    if (!event || event.sourceId === SOURCE_ID) {
      return;
    }

    emitLocal(event);
  }

  function notify(topics, payload = {}) {
    const normalizedTopics = [...new Set(
      (Array.isArray(topics) ? topics : [topics])
        .map((topic) => String(topic || '').trim())
        .filter(Boolean)
    )];

    if (!normalizedTopics.length) {
      return;
    }

    const event = {
      sourceId: SOURCE_ID,
      topics: normalizedTopics,
      payload,
      emittedAt: Date.now()
    };

    emitLocal(event);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Falha ao publicar evento de sincronizacao no storage:', error);
    }

    if (channel) {
      channel.postMessage(event);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handleIncoming(JSON.parse(event.newValue));
    } catch (error) {
      console.error('Falha ao ler evento de sincronizacao do storage:', error);
    }
  });

  if (channel) {
    channel.addEventListener('message', (event) => handleIncoming(event.data));
  }

  global.SafisaSync = {
    notify,
    subscribe: addListener
  };
})(window);
