const fs = require('fs-extra');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.join(PROJECT_ROOT, 'data', 'backups');
const ACTIONS_LOG = path.join(BACKUP_ROOT, 'actions.log');

// Arquivos críticos identificados na inspeção
const FILES_TO_BACKUP = [
  'logs/webhook-events.json',
  'output/leads.json',
  'output/integrations.json'
];

async function run() {
  // Formato YYYYMMDD_HHMMSS
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  
  const backupDir = path.join(BACKUP_ROOT, timestamp);

  console.log(`📦 Iniciando backup em: ${backupDir}`);
  await fs.ensureDir(backupDir);

  const backedUp = [];

  for (const relativePath of FILES_TO_BACKUP) {
    const sourcePath = path.join(PROJECT_ROOT, relativePath);
    const destPath = path.join(backupDir, path.basename(relativePath));

    if (await fs.pathExists(sourcePath)) {
      await fs.copy(sourcePath, destPath);
      const stats = await fs.stat(sourcePath);
      backedUp.push(`${path.basename(relativePath)} (${stats.size} bytes)`);
    }
  }

  if (backedUp.length > 0) {
    const logLine = `${new Date().toISOString()} | backup | ${backedUp.join(', ')}\n`;
    await fs.ensureFile(ACTIONS_LOG);
    await fs.appendFile(ACTIONS_LOG, logLine);
    console.log(`✅ Backup concluído com sucesso.`);
    console.log(`📂 Arquivos copiados:\n - ${backedUp.join('\n - ')}`);
  } else {
    console.log(`⚠️ Nenhum arquivo crítico encontrado para backup.`);
  }
}

run().catch(err => {
  console.error('❌ Falha no backup:', err);
  process.exit(1);
});