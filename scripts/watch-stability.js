#!/usr/bin/env node

/**
 * Скрипт автоматического мониторинга стабильности
 * Запускает проверки при изменении файлов
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CHECK_SCRIPT = path.join(__dirname, 'check-stability.js');

// Проверяем наличие chokidar
let chokidar;
try {
  chokidar = require('chokidar');
} catch {
  console.log('⚠️  chokidar not found. Installing...');
  try {
    execSync('npm install --save-dev chokidar', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    chokidar = require('chokidar');
  } catch (error) {
    console.error('❌ Failed to install chokidar. Please install it manually: npm install --save-dev chokidar');
    process.exit(1);
  }
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

let checkTimeout = null;
let isChecking = false;

function runStabilityCheck() {
  if (isChecking) {
    log('⏳ Check already in progress, skipping...', 'yellow');
    return;
  }

  isChecking = true;
  log('\n🔄 Running stability check...', 'blue');

  try {
    execSync(`node ${CHECK_SCRIPT}`, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    log('✅ Stability check passed!', 'green');
  } catch (error) {
    log('❌ Stability check failed!', 'red');
    // Не выходим из процесса, продолжаем мониторинг
  } finally {
    isChecking = false;
  }
}

function debouncedCheck() {
  if (checkTimeout) {
    clearTimeout(checkTimeout);
  }

  // Запускаем проверку через 2 секунды после последнего изменения
  checkTimeout = setTimeout(() => {
    runStabilityCheck();
  }, 2000);
}

// Настраиваем наблюдение за файлами
const watchPaths = [
  path.join(PROJECT_ROOT, 'src'),
  path.join(PROJECT_ROOT, 'package.json'),
  path.join(PROJECT_ROOT, 'tsconfig.json'),
  path.join(PROJECT_ROOT, 'vite.config.ts'),
];

log('👀 Starting file watcher...', 'blue');
log(`Watching: ${watchPaths.join(', ')}`, 'blue');

const watcher = chokidar.watch(watchPaths, {
  ignored: [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /\.next/,
  ],
  persistent: true,
  ignoreInitial: true,
});

watcher
  .on('add', (filePath) => {
    log(`📄 File added: ${path.relative(PROJECT_ROOT, filePath)}`, 'yellow');
    debouncedCheck();
  })
  .on('change', (filePath) => {
    log(`📝 File changed: ${path.relative(PROJECT_ROOT, filePath)}`, 'yellow');
    debouncedCheck();
  })
  .on('unlink', (filePath) => {
    log(`🗑️  File deleted: ${path.relative(PROJECT_ROOT, filePath)}`, 'yellow');
    debouncedCheck();
  })
  .on('error', (error) => {
    log(`❌ Watcher error: ${error.message}`, 'red');
  })
  .on('ready', () => {
    log('✅ File watcher ready!', 'green');
    log('🔄 Running initial stability check...', 'blue');
    runStabilityCheck();
  });

// Обработка сигналов завершения
process.on('SIGINT', () => {
  log('\n🛑 Stopping watcher...', 'yellow');
  watcher.close();
  if (checkTimeout) {
    clearTimeout(checkTimeout);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Stopping watcher...', 'yellow');
  watcher.close();
  if (checkTimeout) {
    clearTimeout(checkTimeout);
  }
  process.exit(0);
});

log('\n✅ Stability monitor is running. Press Ctrl+C to stop.', 'green');

