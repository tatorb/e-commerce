<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mcp-server -->
<!-- Sección: MCP Mercado Libre -->

# Mercado Libre MCP Server

Última actualización 10/09/2026

## MCP Server de Mercado Libre

El Model Context Protocol (MCP) es un protocolo abierto que estandariza la conexión de modelos de inteligencia artificial con diferentes fuentes de datos y herramientas. El MCP Server de Mercado Libre ofrece utilidades para que los desarrolladores puedan interactuar fácilmente con APIs y recursos de Mercado Libre usando lenguaje natural, simplificando tareas e integraciones de productos.

## Requisitos previos

Antes de comenzar, asegúrate de contar con el siguiente entorno:

| Requisito | Descripción |
| --- | --- |
| **Cliente MCP** | Un cliente compatible (por ejemplo, Cursor, Windsurf, Cline, Claude Desktop, ChatGPT, etc). |
| **Cuenta de Mercado Libre** | Una cuenta activa en Mercado Libre. La autenticación se realiza mediante OAuth 2.0 directamente desde el cliente MCP. |

## Autenticación

El MCP Server de Mercado Libre utiliza **OAuth 2.0**  como método de autenticación y autorización. Este enfoque se alinea con los estándares de la industria y elimina la necesidad de gestionar Access Tokens de forma manual.

Nota:

Al conectarte por primera vez, la aplicación cliente (Cursor, Windsurf, Claude Desktop, etc.) iniciará automáticamente el flujo de autenticación OAuth con Mercado Libre, lo cual consiste en abrir una pestaña en tu navegador, seleccionar el país, autorizar la integración, y ser redirigido a la aplicación. Una vez autorizado, las credenciales son gestionadas de forma automática.

## Instalación y configuración

Importante:

1. El MCP no funciona si nos autenticamos con credenciales de usuario TEST.

2. En la mayoría de IDEs y, en general, LLMs, nos pedirá que una vez que quede configurado, reiniciemos la sesión para que estos cambios queden aplicados.

3. Considerar configurar el MCP según las necesidades, ya sea por scope o de manera global.

### Claude

Para conectarte al MCP DevSite de Mercado Libre desde Claude, ejecuta el siguiente comando:

```
claude mcp add --transport http mercadolibre-devsite-mcp https://mcp.mercadolibre.com/devsite/v1/mcp -s user
```

También puedes configurarlo manualmente en el archivo de configuración local o del proyecto. Agrega el siguiente bloque:

JSON:

```
{
  "mcpServers": {
    "mercadolibre-devsite-mcp": {
      "type": "http",
      "url": "https://mcp.mercadolibre.com/devsite/v1/mcp"
    }
  }
}
```

### Codex

Para conectarte al servidor MCP de Mercado Libre desde Codex, agrega el siguiente bloque en el archivo `config.toml` de la configuración global o del proyecto:

TOML:

```
[mcp_servers.mercadolibre-mcp-server]
url = "https://mcp.mercadolibre.com/devsite/v1/mcp"
enabled = true
```

Note:

Una vez guardada la configuración, pídele al modelo que inicie la conexión al MCP de Mercado Libre. Esto detonará automáticamente el flujo de autenticación OAuth: se abrirá una pestaña en tu navegador, deberás seleccionar el país, autorizar la integración y ser redirigido. Al completar la autenticación, la configuración queda lista.

### Cursor

Para conectarse a nuestro MCP de Mercado Libre, primero es necesario realizar la conexión con el cliente que mejor se ajuste a tu integración. Verifica el paso a paso según el tipo de cliente.

En Cursor, puede hacer clic en el botón a continuación o seguir los pasos manualmente.

Para conectarse al servidor MCP de Mercado Libre desde Cursor de forma manual, seguí estos pasos:

```
Cursor Settings > Tools & Integrations > New MCP Server
```

Esto abrirá una pestaña donde podrás visualizar y configurar los servidores MCP disponibles. En la configuración, asegúrate de incluir el siguiente bloque JSON para conectar con el servidor MCP:

JSON:

```
{
  "mcpServers": {
    "mercadolibre-mcp-server": {
      "url": "https://mcp.mercadolibre.com/devsite/v1/mcp"
    }
  }
}
```

Note:

Al guardar la configuración, Cursor iniciará automáticamente el flujo de autenticación OAuth con Mercado Libre, lo cual consiste en abrir una pestaña en tu navegador, seleccionar el país, autorizar la integración, y ser redirigido a Cursor. No es necesario agregar un token de forma manual.

### Windsurf

Para conectarse al servidor MCP de Mercado Libre desde Windsurf, seguí estos pasos:

```
Cascade > MCP Servers > Configure
```

JSON:

```
{
  "mcpServers": {
    "mercadolibre-mcp-server": {
      "serverUrl": "https://mcp.mercadolibre.com/devsite/v1/mcp"
    }
  }
}
```

Note:

Al guardar la configuración, Windsurf iniciará automáticamente el flujo de autenticación OAuth con Mercado Libre, lo cual consiste en abrir una pestaña en tu navegador, seleccionar el país, autorizar la integración, y ser redirigido a Windsurf. No es necesario agregar un token de forma manual.

### Gemini

Para conectarte al servidor MCP de Mercado Libre desde Gemini, agrega el siguiente bloque en el archivo `settings.json` de la configuración global o del proyecto:

JSON:

```
{
  "mcpServers": {
    "mercadolibre-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.mercadolibre.com/devsite/v1/mcp"
      ]
    }
  }
}
```

Note:

Una vez guardada la configuración, pídele a Gemini que se conecte al MCP de Mercado Libre. Esto detonará automáticamente el flujo de autenticación OAuth: se abrirá una pestaña en tu navegador, deberás seleccionar el país, autorizar la integración y ser redirigido. Al completar la autenticación, la configuración queda lista.

### Otros IDEs

Abre la configuración del IDE y busca el archivo JSON referente a servidores MCP.

Note:

Al guardar la configuración, el cliente iniciará automáticamente el flujo de autenticación OAuth con Mercado Libre, lo cual consiste en abrir una pestaña en tu navegador, seleccionar el país, autorizar la integración, y ser redirigido a la aplicación. No es necesario agregar un token de forma manual.

JSON:

```
{
  "mcpServers": {
    "mercadolibre-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.mercadolibre.com/devsite/v1/mcp"
      ]
    }
  }
}
```

## Conexión al MCP Server

1. Establece la conexión remota desde tu cliente preferido (ejemplo: Cursor).

2. Al conectarte por primera vez, se abrirá automáticamente el flujo de autenticación OAuth en el navegador. Iniciá sesión con tu cuenta de Mercado Libre y autorizá el acceso.

3. Asegúrate de que el servidor MCP esté disponible y correctamente configurado en tu cliente.

4. Si no aparece, revisa la configuración y recarga la lista de servidores MCP.

## Herramientas disponibles

El MCP Server de Mercado Libre expone herramientas para facilitar la integración y consulta de información relevante.

### search_documentation

Habilita la búsqueda de términos específicos o conceptos clave en toda la documentación técnica para desarrolladores de Mercado Libre.

- **query** : Palabras clave que se desean buscar dentro de la documentación (Obligatorio)

- **language** : Idioma de la documentación a consultar (ej: en_us, es_ar, pt_br) (Obligatorio)

- **siteId** : ID del país para filtrar resultados (ej: MLA, MLB, MLM, etc) (Opcional)

- **limit** : Máximo de resultados a devolver (Opcional)

- **offset** : Número de resultados a omitir (Opcional)

### get_documentation_page

Obtiene el contenido íntegro de una página puntual de la documentación, útil para acceder a especificaciones o casos de uso detallados.

- **path** : Ruta de la página a obtener (Obligatorio)

- **language** : Idioma de la documentación a consultar (ej: en_us, es_ar, pt_br) (Obligatorio)

- **siteId** : ID del país para filtrar resultados (ej: MLA, MLB, MLM, etc) (Opcional)

## Casos de uso

Importante:

Los ejemplos de esta sección utilizan Cursor como cliente MCP, pero puedes utilizar cualquier cliente MCP que prefieras.

### Buscar en documentación desde tu IDE

Las herramientas (tools) no son utilizadas directamente por el usuario o desarrollador, sino por el IDE Agéntico. Por ejemplo:

La herramienta **search_documentation**  permite al IDE Agéntico buscar términos clave dentro de toda la documentación oficial de Mercado Libre y recuperar los endpoints o rutas más relevantes para el contexto consultado.

Luego, con la herramienta **get_documentation_page** , el IDE Agéntico accede al contenido completo de las rutas identificadas en el paso anterior, permitiendo así obtener información específica y casos de uso concretos directamente desde la documentación.

De esta manera, el IDE automatiza la consulta y navegación por la documentación, facilitando que el desarrollador reciba respuestas contextualizadas y precisas sin tener que buscar manualmente.

### Generar código de integración

Además de consultar la documentación, **las tools del MCP son utilizadas por el IDE Agéntico**  para generar código y asistir en la integración de productos en tus proyectos.

Por ejemplo, podés solicitar al asistente que revise la documentación del producto que desees integrar y que identifique los pasos necesarios para completar la integración. El MCP Server provee el contexto relevante (incluyendo ejemplos de código y documentación técnica), que el IDE Agéntico usa para sugerir o incluso aplicar directamente las modificaciones requeridas en tu proyecto.

**De esta forma, el IDE automatiza la consulta, el análisis y la implementación de integraciones, facilitando el trabajo del desarrollador y acelerando el proceso de desarrollo.**

Puedes solicitar recomendaciones para implementar integraciones específicas, por ejemplo:

## Errores y soluciones

### Error en el flujo de autenticación OAuth

Si al intentar conectarte, la aplicación queda en estado "Loading Tools" indefinidamente o no logra establecer conexión con el servidor, es posible que haya un problema con el flujo de autenticación.

**Posibles causas:**

- El flujo OAuth no se completó correctamente (se cerró la ventana del navegador antes de autorizar).

- Las credenciales de la sesión han expirado.

- El cliente MCP no soporta el flujo OAuth requerido. Asegúrate de usar una versión actualizada del cliente.

- La URL del servidor MCP está mal configurada.

**Soluciones sugeridas:**

- Desconecta y vuelve a conectar el servidor MCP para reiniciar el flujo de autenticación.

- Asegúrate de completar el flujo de autorización en el navegador antes de cerrar la ventana.

- Verifica que la URL configurada sea exactamente `https://mcp.mercadolibre.com/devsite/v1/mcp`.

- Actualiza tu cliente MCP a la última versión disponible.
