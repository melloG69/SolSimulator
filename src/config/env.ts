interface EnvConfig {
  JITO_API_KEY: string;
  SOLANA_RPC_URL: string;
  LIGHTHOUSE_API_KEY: string;
}

const getEnvVar = (key: keyof EnvConfig): string => {
  const value = import.meta.env[key];
  if (!value) {
    console.warn(`Missing environment variable: ${key}`);
    return '';
  }
  return value;
};

export const env = {
  JITO_API_KEY: getEnvVar('JITO_API_KEY'),
  SOLANA_RPC_URL: getEnvVar('SOLANA_RPC_URL'),
  LIGHTHOUSE_API_KEY: getEnvVar('LIGHTHOUSE_API_KEY'),
} as const;

// Validate required environment variables
const requiredVars: (keyof EnvConfig)[] = ['JITO_API_KEY', 'SOLANA_RPC_URL', 'LIGHTHOUSE_API_KEY'];
requiredVars.forEach(key => {
  if (!env[key]) {
    console.error(`Missing required environment variable: ${key}`);
  }
}); 