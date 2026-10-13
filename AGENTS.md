# AGENTS.md — Руководство по архитектуре и разработке проекта

Этот документ предназначен для AI-агентов и разработчиков, работающих над кодовой базой **tgxray** (Telegram Desktop + встроенный Xray-core).

---

## 1. Обзор проекта и назначение

**tgxray** — это десктопное приложение на базе **Electron**, объединяющее интерфейс **Telegram Web (версия K)** со встроенным ядром обхода цензуры **Xray-core**.

### Ключевая цель
Обеспечить пользователю прозрачный доступ к Telegram в условиях сетевых блокировок (РКН, корпоративные фаерволы, DPI) через современные протоколы (VLESS + Reality, VLESS + WS, XHTTP/Split-HTTP, VMess, Trojan, Shadowsocks) **без необходимости** настраивать системный VPN, сторонние клиенты (Nekoray, v2rayN) или браузерные расширения.

---

## 2. Архитектура системы

Приложение разделено на три изолированных контура:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Main Process (Node.js)                          │
│                                                                        │
│   ┌──────────────────┐               ┌──────────────────────────────┐  │
│   │   XrayManager    │───spawn──────▶│ xray-core (child process)    │  │
│   │                  │               │   SOCKS5 inbound :port       │  │
│   │                  │               │   HTTP   inbound :port       │  │
│   └────────┬─────────┘               └──────────────────────────────┘  │
│            │                                                           │
│            ▼                                                           │
│   ┌────────────────────────────────┐                                   │
│   │   ConnectionManager            │                                   │
│   │   session.setProxy({           │                                   │
│   │     proxyRules: 'http://...'   │                                   │
│   │   })                           │                                   │
│   └────────┬───────────────────────┘                                   │
│            │                                                           │
│            │ IPC & Lifecycle                                           │
└────────────┼───────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BrowserWindow (Chromium UI)                          │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Top Control Bar (44px) + Settings / Logs Overlay               │   │
│   │ (React 18 + TypeScript, собран через Vite)                     │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ BrowserView: https://web.telegram.org/k/                       │   │
│   │ Session Partition: 'persist:tgxray'                            │   │
│   │ (Весь трафик принудительно заворачивается в локальный прокси)  │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Структура каталогов и назначение файлов

```
├── electron.vite.config.ts    # Конфиг electron-vite (main, preload, renderer)
├── electron-builder.json      # Конфигурация дистрибутивов (Linux, Win, Mac, Portable)
├── package.json               # Зависимости, скрипты сборки, пин версии xrayVersion
├── tsconfig.json              # Корневой tsconfig (project references)
├── tsconfig.node.json         # TS-конфиг для Node.js (main, preload, shared)
├── tsconfig.web.json          # TS-конфиг для DOM/React (renderer)
├── resources/
│   ├── bin/                   # Бинарники xray-core под каждую ОС (win32, darwin, linux)
│   └── icons/                 # Иконки приложения (icon.png, icon.ico, tray-*.png)
├── scripts/
│   ├── fetch-xray.ts          # Загрузка бинарников Xray с GitHub Releases
│   └── generate-icons.py      # Скрипт генерации растровых и трей-иконок
└── src/
    ├── main/                  # Главный процесс Electron
    │   ├── index.ts           # Точка входа, BrowserWindow, BrowserView, меню, уведомления
    │   ├── connection.ts      # Высокоуровневое управление подключением и проксированием
    │   ├── xray-manager.ts    # Жизненный цикл xray-core: spawn, kill, рестарт, healthcheck
    │   ├── config-store.ts    # Хранилище профилей, шифрование через safeStorage
    │   ├── logger.ts          # Сбор логов приложения и Xray с маскированием секретов
    │   ├── tray.ts            # Управление системным треем и сменой иконок
    │   ├── ipc-handlers.ts    # Регистрация IPC-хэндлеров для renderer
    │   └── proxy-bridge.ts    # Дополнительный HTTP->SOCKS5 мост (при необходимости)
    ├── preload/               # Preload-скрипт изоляции контекста
    │   ├── index.ts           # Экспорт window.tgxray API через contextBridge
    │   └── index.d.ts         # Типизация Window.tgxray
    ├── renderer/              # Интерфейс управления
    │   ├── index.html         # HTML-контейнер
    │   ├── main.tsx           # React bootstrap
    │   ├── App.tsx            # Верхний бар + логика переключения оверлея настроек
    │   ├── styles.css         # Базовые стили
    │   ├── profiles/          # Управление профилями (добавление, вставка из clipboard, CRUD)
    │   ├── settings/          # Системные настройки (автозапуск, автоподключение, логи)
    │   └── logs/              # Просмотр логов в реальном времени с фильтрацией
    └── shared/                # Код, общий для main, preload и renderer
        ├── types.ts           # TypeScript-интерфейсы моделей и IPC
        ├── parse-link.ts      # Парсер ссылок vless://, vmess://, trojan://, ss://
        ├── build-config.ts    # Построение валидного JSON-конфига для Xray-core
        └── mask.ts            # Регулярные выражения и утилиты маскирования секретов
```

---

## 4. Критические правила для Агента

При внесении изменений в проект строго соблюдайте следующие правила:

### 1. Безопасность и защита секретов
- **Никогда** не сохраняйте конфигурации в открытом тексте. Всегда используйте `safeStorage` в `src/main/config-store.ts`.
- **Никаких секретов в логах**: все строки перед выводом в консоль или сохранением в лог-файл **обязаны** проходить через `maskSecret()` из `src/shared/mask.ts` (маскирование UUID, паролей, `pbk`, `sid`, `shortId`).
- `BrowserWindow` и `BrowserView` должны сохранять изоляцию:
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

### 2. Парсер ссылок (`src/shared/parse-link.ts`)
- **Reality**: обязательно формирует секцию `realitySettings` с полями `serverName`, `publicKey` (из `pbk`), `shortId` (из `sid`), `spiderX` (из `spx`), `fingerprint` (из `fp`).
- **XHTTP / Split-HTTP**: обрабатывает `type=xhttp` и `type=splithttp`, генерируя секцию `xhttpSettings`.
- **WebSocket**: генерирует `wsSettings` с корректным заголовком `Host` и `path`.

### 3. Сеть и маршрутизация (`src/shared/build-config.ts` и `src/main/connection.ts`)
- Xray настраивается с двумя локальными инбаундами:
  - `socks-in` (SOCKS5 на случай кастомных клиентов).
  - `http-in` (HTTP-прокси).
- Сессия Electron (`persist:tgxray`) напрямую подключается к локальному HTTP-порту Xray:
  ```typescript
  await ses.setProxy({
    proxyRules: `http://127.0.0.1:${res.httpPort}`,
    proxyBypassRules: '<-loopback>'
  })
  ```
- В правилах маршрутизации Xray (`routing.rules`) весь входящий трафик с локальных инбаундов должен явно перенаправляться на активный `outboundTag`.

### 4. Жизненный цикл процесса Xray
- Обязателен `graceful shutdown` при закрытии приложения (`before-quit`, `SIGINT`, `SIGTERM`), чтобы не оставлять зомби-процессов `xray` в системе.
- Обязателен healthcheck локального порта перед тем, как переводить статус соединения в `connected`.

---

## 5. Сборка и тестирование

### Проверка типов и линтинг
```bash
npm run typecheck
```
*Всегда запускайте после любых правок TypeScript! Ошибок типов быть не должно.*

### Сборка бандла Vite
```bash
npm run build
```

### Сборка инсталляторов и портативных версий
```bash
npm run dist:linux           # AppImage и deb для Linux
npm run dist:win             # NSIS инсталлятор для Windows
npm run dist:win:portable    # Портативный .exe для Windows (не требует установки)
npm run dist:mac             # DMG для macOS
```

---

## 6. Чеклист при реализации новых фич

- [ ] Код строго типизирован (нет `any`, где это возможно).
- [ ] Запущен `npm run typecheck` — завершился с кодом 0.
- [ ] Запущен `npm run build` — сборка main, preload и renderer успешна.
- [ ] Секреты пользователя не утекают в логи или незашифрованные файлы.
- [ ] Кроссплатформенность сохранена (проверены пути на Linux/macOS через `path.join`, без захардкоженных бэкслешей `\`).
