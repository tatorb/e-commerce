// Conexión de una tienda con su canal por API (OAuth): cada cliente crea su
// propia aplicación en el canal, la app le pide permiso a su cuenta y recibe
// llaves que vencen y se renuevan. Solo corre en el servidor. Cada canal lo
// resuelve en src/channels/<canal>/; el resto de la app usa esta interfaz.

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string | null;
  // La cuenta del canal que autorizó.
  userId: string;
};

export class ConnectError extends Error {
  constructor(
    message: string,
    // La autorización ya no sirve: hay que volver a conectar.
    readonly reauth = false,
  ) {
    super(message);
  }
}

export interface ChannelConnector {
  /** Pasos para crear la aplicación en el canal, para mostrarlos en pantalla. */
  setupSteps(redirectUri: string): string[];
  /** Dirección del canal donde la persona da permiso. */
  authorizeUrl(args: { appId: string; redirectUri: string; state: string; codeChallenge: string }): string;
  /** Cambia el código que devuelve el canal por las llaves. */
  exchangeCode(args: { appId: string; appSecret: string; code: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet>;
  /** Renueva las llaves. La de renovación vieja deja de servir. */
  refresh(args: { appId: string; appSecret: string; refreshToken: string }): Promise<TokenSet>;
  /** La cuenta dueña de la llave. */
  whoAmI(accessToken: string): Promise<{ id: string; nickname: string }>;
  /** De quién es cada publicación, por su código, para chequear que la cuenta sea la de la tienda. */
  ownersOf(accessToken: string, externalIds: string[]): Promise<Map<string, string>>;
  /** Avisa al canal que la app deja de usar la autorización. Si falla, no importa. */
  revoke(args: { accessToken: string; userId: string; appId: string }): Promise<void>;
}

