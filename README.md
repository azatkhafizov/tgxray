# Telegram Desktop (Xray Proxy)

Кроссплатформенный десктопный клиент для **Telegram Web (версия K)** со встроенным ядром **Xray-core**. Позволяет использовать прокси-конфигурации (VLESS / Reality / VMess / Trojan / Shadowsocks) без необходимости настраивать системный прокси, сторонние VPN-клиенты или расширения браузера.

---

## Возможности

- **Интегрированный Telegram Web K**: открывается в нативном окне Electron с изолированной персистентной сессией (`persist:tgxray`), сохраняет авторизацию и кэш между запусками.
- **Поддержка протоколов Xray**:
  - `VLESS` (включая **Reality**, **WS**, **XHTTP / Split-HTTP**, gRPC).
  - `VMess` (WS, gRPC, TCP).
  - `Trojan`.
  - `Shadowsocks`.
  - Нативные конфигурационные файлы `config.json`.
- **Встроенный менеджер Xray**:
  - Автоматический подбор свободных локальных портов (SOCKS5 / HTTP).
  - Запуск дочернего процесса `xray-core` с graceful shutdown и перезапуском при сбоях.
  - Проверка доступности соединения (healthcheck) и определение внешнего IP-адреса.
- **Безопасность**:
  - Хранение профилей в зашифрованном виде с использованием `safeStorage` (системный Keychain / DPAPI / Secret Service).
  - Маскирование UUID, ключей Reality и паролей в логах приложения.
  - `contextIsolation: true`, `sandbox: true`, отключен `nodeIntegration`.
- **Интеграция с ОС**:
  - Динамическая иконка в системном трее с цветовым индикатором статуса (⚪ Отключен, 🟡 Подключение, 🟢 Подключен, 🔴 Ошибка).
  - Поддержка нативных push-уведомлений Telegram (Windows 10/11, macOS, Linux).
  - Мигание иконки в панели задач / прыжок в Dock при непрочитанных сообщениях.
  - Скрытие в трей при закрытии окна.
  - Открытие внешних ссылок из чатов в системном браузере по умолчанию.

---

## Архитектура

```
┌────────────────────────────────────────────────────────┐
│                   Main Process (Node.js)               │
│                                                        │
│  ┌─────────────────┐           ┌────────────────────┐  │
│  │  XrayManager    │──spawn───▶│ xray-core (child)  │  │
│  │                 │           │ SOCKS5 :port       │  │
│  │                 │           │ HTTP   :port       │  │
│  └────────┬────────┘           └────────────────────┘  │
│           │                                            │
│           ▼                                            │
│  ┌─────────────────────────────┐                       │
│  │ session.setProxy(httpPort)  │                       │
│  └────────┬────────────────────┘                       │
└───────────┼────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────┐
│                   BrowserWindow                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Top Control Bar & Settings Overlay (React + Vite)│  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ BrowserView: https://web.telegram.org/k/         │  │
│  │ (весь трафик маршрутизируется через локальный    │  │
│  │  HTTP-инбаунд Xray)                              │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Технологический стек

- **Платформа**: [Electron](https://www.electronjs.org/) 33
- **Сборщик**: [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) 5
- **UI**: [React](https://react.dev/) 18 + TypeScript
- **Ядро прокси**: [Xray-core](https://github.com/XTLS/Xray-core) (версия фиксируется в `package.json`)
- **Упаковка**: [electron-builder](https://www.electron.build/)

---

## Требования для разработки

- **Node.js** >= 18.x (рекомендуется 20.x или 22.x)
- **npm** >= 9.x
- Для Linux: пакеты `unzip` (для распаковки бинарников Xray).

---

## Быстрый старт (Разработка)

1. **Клонирование репозитория и установка зависимостей**:
   ```bash
   git clone <URL_РЕПОЗИТОРИЯ>
   cd web_telegram_to_desktop_from_xray
   npm install
   ```

2. **Загрузка бинарников Xray-core**:
   Скрипт скачает официальные релизы `xray-core` с GitHub для Windows, macOS и Linux:
   ```bash
   npm run fetch-xray
   ```

3. **Запуск в режиме разработки**:
   ```bash
   npm run dev
   ```

4. **Использование**:
   - Нажмите кнопку **«⚙ Proxy & Settings»** в верхней панели.
   - Во вкладке **Profiles** нажмите **«Paste from clipboard»** (или вставьте `vless://...`, `vmess://...` вручную) и сохраните профиль.
   - Нажмите **«Connect»**. После перехода индикатора в зелёный статус Telegram Web загрузится через прокси.

---

## Сборка установщиков

Перед сборкой убедитесь, что бинарники Xray скачаны (`npm run fetch-xray`).

### Linux (AppImage, deb)
```bash
npm run dist:linux
```
Готовые пакеты появятся в каталоге `release/`:
- `release/Telegram Xray-<версия>.AppImage`
- `release/tgxray_<версия>_amd64.deb`

### Windows (NSIS-установщик)
```bash
npm run dist:win
```
- `release/Telegram Xray Setup <версия>.exe`

### macOS (DMG)
```bash
npm run dist:mac
```
- `release/Telegram Xray-<версия>.dmg`

---

## Доступные скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск приложения в dev-режиме с Hot Module Replacement |
| `npm run build` | Компиляция TypeScript и сборка Vite/Rollup (main, preload, renderer) |
| `npm run typecheck` | Статическая проверка типов TypeScript без генерации файлов |
| `npm run fetch-xray` | Загрузка бинарников Xray-core с GitHub Releases |
| `npm run dist:linux` | Сборка дистрибутива под Linux (`.AppImage`, `.deb`) |
| `npm run dist:win` | Сборка дистрибутива под Windows (`.exe` NSIS) |
| `npm run dist:mac` | Сборка дистрибутива под macOS (`.dmg`) |

---

## Структура проекта

```
├── electron.vite.config.ts    # Конфигурация electron-vite
├── electron-builder.json      # Настройки сборки установщиков
├── package.json
├── resources/
│   ├── bin/                   # Бинарные файлы xray-core (win32, darwin, linux)
│   └── icons/                 # Иконки приложения и статусные иконки трея
├── scripts/
│   ├── fetch-xray.ts          # Загрузка и распаковка релизов Xray-core
│   └── generate-icons.py      # Генерация иконок приложения
└── src/
    ├── main/                  # Main процесс Electron
    │   ├── index.ts           # Главное окно, BrowserView, жизненный цикл
    │   ├── connection.ts      # Менеджер подключения и проксирования
    │   ├── xray-manager.ts    # Управление процессом Xray (spawn, restart, healthcheck)
    │   ├── config-store.ts    # Зашифрованное хранилище профилей (safeStorage)
    │   ├── logger.ts          # Логирование с маскированием секретов
    │   ├── tray.ts            # Управление системным треем и контекстным меню
    │   └── ipc-handlers.ts    # Обработчики IPC-запросов
    ├── preload/               # Preload-скрипт (безопасный contextBridge)
    │   ├── index.ts
    │   └── index.d.ts
    ├── renderer/              # React UI (панель управления, профили, логи)
    │   ├── App.tsx
    │   ├── profiles/
    │   ├── settings/
    │   └── logs/
    └── shared/                # Общие типы и парсеры
        ├── types.ts           # Интерфейсы и типы IPC
        ├── parse-link.ts      # Парсер ссылок VLESS, VMess, Trojan, SS, XHTTP
        ├── build-config.ts    # Генерация конфига Xray JSON
        └── mask.ts            # Маскирование секретов и UUID
```

---

## Лицензия

MIT
