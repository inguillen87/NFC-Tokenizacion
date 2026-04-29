export function parseBootstrapArgs(argv = []) {
  const args = new Set(argv);
  return {
    withDemo: args.has('--with-demo'),
    dryRun: args.has('--dry-run'),
  };
}

export function shouldCreateDemoTenant({ demoModeEnv, withDemoFlag }) {
  return String(demoModeEnv || '').toLowerCase() === 'true' || withDemoFlag === true;
}

export function collectMissingBootstrapEnv(env) {
  const required = ['DATABASE_URL', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
  return required.filter((key) => !String(env[key] || '').trim());
}
