# Carruseles IA

Ruta `/carousels`. Genera cada lámina completa (texto, logo, ilustración y composición) con la API de OpenAI. No utiliza la suscripción de ChatGPT ni el proveedor de textos activo del resto del dashboard.

## Uso

1. Guarda tu API key en el estudio o en Ajustes. Se reutiliza `OPENAI_API_KEY` si no hay una clave guardada.
2. Define nombre de marca, paleta, tipografías, público, tono y reglas. Sube un logo y hasta cinco diseños propios. Nombre y estilo (texto o ejemplos) son obligatorios.
3. Sube hasta doce imágenes del carrusel original en orden, escribe un tema, o combina ambas cosas. Puedes reordenar las referencias. Elige de 2 a 12 láminas, formato y calidad.
4. Analiza con IA. Revisa la interpretación de la referencia, dirección de arte y textos de cada lámina.
5. Genera las imágenes. Primero se crea la portada; las siguientes reciben esa portada y los ejemplos de marca como referencias visuales. Los originales solo se usan al analizar contenido, evitando trasladar su identidad a la nueva marca.
6. Ajusta y regenera una lámina, descarga cada PNG o el ZIP con imágenes numeradas y caption.

Predeterminado: formato 4:5, 1024 × 1280 y calidad alta. Las referencias se optimizan localmente a WebP, máximo 190.000 caracteres por imagen; las imágenes generadas se conservan a su resolución original.

## Persistencia y credenciales

Identidad, referencias, guion y resultados se guardan en IndexedDB, en este navegador y origen. No se sincronizan entre usuarios ni dispositivos. Se puede exportar/restaurar una copia JSON sin credenciales. «Nuevo carrusel» descarga la copia actual y conserva la identidad. Una restauración sustituye el proyecto abierto; exporta primero si quieres conservarlo.

La API key usa el almacén de configuración existente del servidor. Este proyecto es un dashboard personal: la clave es de la instalación, no de una cuenta de usuario autenticada. No desplegar como servicio público multiusuario sin incorporar autenticación, aislamiento de claves y cuotas. La suscripción de ChatGPT y el consumo API tienen facturación separada.

## Implementación

- `POST /api/ai/carousel` valida con Zod, limita el cuerpo a 4 MB y rechaza orígenes cruzados.
- `action: analyze`: Chat Completions con entradas visuales y salida JSON validada, sin fallback de demostración.
- `action: generate`: una lámina por petición. Images edits con imágenes de marca y portada; Images generations cuando aún no existen referencias visuales.
- `OPENAI_CAROUSEL_TEXT_MODEL`: por defecto `gpt-4o-mini`.
- `OPENAI_IMAGE_MODEL`: por defecto `gpt-image-2.5-sunburst`. Un modelo alternativo debe admitir los formatos solicitados.
- Cada lámina terminada se guarda antes de solicitar la siguiente. Si falla, se detiene el lote y quedan las anteriores; «Generar láminas pendientes» reanuda. No se reintentan automáticamente solicitudes que pueden haber generado consumo.
- «Detener después de esta lámina» termina y guarda la petición actual. Mantén la página abierta durante la generación: no hay cola de trabajo en segundo plano.
- Tiempo máximo de petición: 300 segundos, con timeout de OpenAI de 240 segundos. El hosting debe permitir esa duración. Se conserva el resultado en el navegador, no en el disco efímero del servidor.
- Cambiar marca, tema, referencias, cantidad, calidad o formato invalida el guion y sus imágenes. Editar una lámina invalida solo esa imagen; editar la dirección de arte invalida todas. Regenerar la portada conserva las otras imágenes y avisa de que se pueden regenerar para adoptar su nuevo estilo.

La IA puede variar en fidelidad de logos, ortografía o consistencia visual. El guion revisable, el contexto compartido y las referencias reducen esos errores; la vista previa y regeneración permiten corregirlos. Una generación facturable real requiere una API key con saldo y acceso al modelo.

## Verificación

`npm run test:carousel` comprueba contratos y validación, separación entre referencias de contenido y marca, uso de portada como guía, JSON inválido, falta de saldo y ZIP. Los proveedores se simulan; no genera consumo de OpenAI.

Documentación consultada:
- https://developers.openai.com/api/docs/guides/image-generation
- https://developers.openai.com/api/reference/cli/resources/images/methods/edit
- https://help.openai.com/en/articles/9039756
