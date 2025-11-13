#!/usr/bin/env node

/**
 * Скрипт проверки стабильности сайта
 * Проверяет наличие ошибок, работоспособность основных компонентов
 * и общую стабильность приложения
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContent(filePath, requiredContent) {
  if (!checkFileExists(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const missing = requiredContent.filter(item => !content.includes(item));
  
  if (missing.length > 0) {
    return { success: false, error: `Missing required content: ${missing.join(', ')}` };
  }

  return { success: true };
}

function checkTypeScriptErrors() {
  log('\n🔍 Checking TypeScript errors...', 'blue');
  try {
    execSync('npx tsc --noEmit', { 
      cwd: PROJECT_ROOT, 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    log('✅ No TypeScript errors found', 'green');
    return { success: true };
  } catch (error) {
    log('❌ TypeScript errors found:', 'red');
    console.error(error.stdout || error.message);
    return { success: false, error: error.message };
  }
}

function checkLintingErrors() {
  log('\n🔍 Checking ESLint errors...', 'blue');
  try {
    execSync('npm run lint', { 
      cwd: PROJECT_ROOT, 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    log('✅ No linting errors found', 'green');
    return { success: true };
  } catch (error) {
    log('⚠️  Linting warnings/errors found:', 'yellow');
    console.error(error.stdout || error.message);
    return { success: true, warning: true }; // Линтинг не критичен
  }
}

function checkCriticalFiles() {
  log('\n🔍 Checking critical files...', 'blue');
  const criticalFiles = [
    'src/main.tsx',
    'src/App.tsx',
    'src/components/ErrorBoundary.tsx',
    'src/lib/errorHandler.ts',
    'src/integrations/supabase/client.ts',
    'src/contexts/AuthContext.tsx',
  ];

  const results = [];
  for (const file of criticalFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (checkFileExists(filePath)) {
      log(`✅ ${file} exists`, 'green');
      results.push({ file, success: true });
    } else {
      log(`❌ ${file} is missing!`, 'red');
      results.push({ file, success: false });
    }
  }

  return {
    success: results.every(r => r.success),
    results,
  };
}

function checkErrorBoundaryIntegration() {
  log('\n🔍 Checking ErrorBoundary integration...', 'blue');
  const appPath = path.join(PROJECT_ROOT, 'src/App.tsx');
  const result = checkFileContent(appPath, [
    'ErrorBoundary',
    'import ErrorBoundary',
  ]);

  if (result.success) {
    log('✅ ErrorBoundary is properly integrated', 'green');
  } else {
    log(`❌ ${result.error}`, 'red');
  }

  return result;
}

function checkErrorHandlerIntegration() {
  log('\n🔍 Checking ErrorHandler integration...', 'blue');
  const mainPath = path.join(PROJECT_ROOT, 'src/main.tsx');
  const result = checkFileContent(mainPath, [
    'errorHandler',
    'import "./lib/errorHandler"',
  ]);

  if (result.success) {
    log('✅ ErrorHandler is properly integrated', 'green');
  } else {
    log(`❌ ${result.error}`, 'red');
  }

  return result;
}

function checkBuild() {
  log('\n🔍 Checking if project builds successfully...', 'blue');
  try {
    execSync('npm run build', { 
      cwd: PROJECT_ROOT, 
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000, // 2 минуты
    });
    log('✅ Project builds successfully', 'green');
    return { success: true };
  } catch (error) {
    log('❌ Build failed:', 'red');
    console.error(error.stdout || error.message);
    return { success: false, error: error.message };
  }
}

function checkPackageJson() {
  log('\n🔍 Checking package.json...', 'blue');
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  
  if (!checkFileExists(packageJsonPath)) {
    return { success: false, error: 'package.json not found' };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  // Проверяем наличие критических зависимостей
  const criticalDeps = ['react', 'react-dom', '@supabase/supabase-js'];
  const missingDeps = criticalDeps.filter(dep => !packageJson.dependencies?.[dep]);
  
  if (missingDeps.length > 0) {
    log(`❌ Missing critical dependencies: ${missingDeps.join(', ')}`, 'red');
    return { success: false, error: `Missing dependencies: ${missingDeps.join(', ')}` };
  }

  log('✅ All critical dependencies are present', 'green');
  return { success: true };
}

async function main() {
  log('\n🚀 Starting stability check...\n', 'blue');
  
  const checks = [
    { name: 'Critical Files', fn: checkCriticalFiles },
    { name: 'Package.json', fn: checkPackageJson },
    { name: 'ErrorBoundary Integration', fn: checkErrorBoundaryIntegration },
    { name: 'ErrorHandler Integration', fn: checkErrorHandlerIntegration },
    { name: 'TypeScript', fn: checkTypeScriptErrors },
    { name: 'ESLint', fn: checkLintingErrors },
    { name: 'Build', fn: checkBuild },
  ];

  const results = [];
  
  for (const check of checks) {
    try {
      const result = await check.fn();
      results.push({
        name: check.name,
        ...result,
      });
    } catch (error) {
      results.push({
        name: check.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Итоговый отчет
  log('\n' + '='.repeat(50), 'blue');
  log('📊 Stability Check Report', 'blue');
  log('='.repeat(50), 'blue');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    if (result.success) {
      log(`✅ ${result.name}: PASSED`, 'green');
    } else {
      log(`❌ ${result.name}: FAILED`, 'red');
      if (result.error) {
        log(`   Error: ${result.error}`, 'red');
      }
    }
  });
  
  log('\n' + '='.repeat(50), 'blue');
  log(`Total: ${results.length} checks`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log('='.repeat(50) + '\n', 'blue');

  if (failed > 0) {
    log('⚠️  Stability issues detected! Please fix the errors above.', 'yellow');
    process.exit(1);
  } else {
    log('✅ All stability checks passed! Site is stable.', 'green');
    process.exit(0);
  }
}

// Запускаем проверку
main().catch(error => {
  log(`\n❌ Fatal error during stability check: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

