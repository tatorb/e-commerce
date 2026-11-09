<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/introduccion-seguridad -->
<!-- Sección: Guía de seguridad -->

# Introducción

Última actualización 30/03/2026

## Prácticas, validaciones y requerimientos de seguridad para integradores

El objetivo de este documento es compartir y mantener una serie de requerimientos de seguridad, que se deben tener en cuenta durante todo el ciclo de vida del desarrollo de la integración. Los puntos que se mencionan a continuación buscan proteger su aplicación/integración de amenazas comunes, como el robo de credenciales, la fuga de información y fraudes comerciales. Impulsamos a nuestros integradores a construir soluciones alineadas con las mejores prácticas de ciberseguridad, asegurando así la integridad y la protección de la información confidencial de los vendedores de Mercado Libre.

**La ausencia de estos controles compromete la continuidad operativa de su integración, desde el incumplimiento de auditorías de mercado libre hasta la posible revocación de los permisos de la API.**  Más allá de lo administrativo, dejaría su infraestructura y la información crítica de los vendedores vulnerable ante amenazas externas.

## Cómo leer esta documentación

Cada sección incluye:

| **Elemento** | **Descripción** |
| --- | --- |
| ¿Por qué es importante? | Explicación del riesgo e importancia del uso de la buena práctica |
| Ejemplos: correcto vs incorrecto | Comparación visual de qué está bien y mal |
| ¿Cómo verificar? | Pasos concretos para comprobar si cumples con la buena práctica |
| Preguntas de autodiagnóstico | Responde Si/No para evaluar la adopción de la práctica en tu integración |

## Gobierno y cumplimiento

### Introducción

En el ecosistema de Mercado Libre, la confianza de los vendedores y compradores es nuestro sello de confianza, y el papel del integrador es crítico para mantener la integridad de esta cadena. Al desarrollar aplicaciones que interactúan con las APIs del marketplace, el integrador no solo gestiona datos operativos, sino que se convierte en un custodio de la experiencia del seller y de la privacidad de sus transacciones.

Esta guía establece los estándares de seguridad necesarios para que las integraciones externas no solo funcionen con eficiencia, sino que actúen como una extensión robusta y segura de nuestra infraestructura, controlando los riesgos de forma que ninguna vulnerabilidad externa impacte la estabilidad organizacional o la confianza de nuestros usuarios finales.

### Responsabilidad de Seguridad

La seguridad en una arquitectura orientada a servicios y APIs no recae en un solo actor, sino que se distribuye bajo un esquema de responsabilidad compartida que delimita las obligaciones de Mercado Libre y las del integrador. Mercado Libre asume la seguridad de la plataforma, lo que implica proteger la infraestructura global, los centros de datos, los protocolos de red y la disponibilidad de los endpoints de la API. Esta responsabilidad abarca desde la capa física hasta la capa de digital que aloja los servicios de marketplace.

Por su parte, el integrador es responsable de la seguridad dentro de su aplicación y de la gestión de los datos que extrae o procesa. Esto incluye la seguridad de sus aplicaciones, las configuraciones del sistema operativo de sus servidores, la actualización de parches de seguridad, la gestión de sus bases de datos y el control de acceso a sus sistemas internos. Un fallo de seguridad en el integrador, como una base de datos mal configurada o un código vulnerable a inyecciones, es responsabilidad directa del integrador. La transparencia en esta división permite que ambas partes enfoquen sus recursos de seguridad de manera efectiva, asegurando que la protección de la información del seller sea hermética en todo el trayecto del dato.

**Siguiente** : [Infraestructura: Cifrado y seguridad de transporte](https://developers.mercadolibre.com.ar/es_ar/infraestructura).
