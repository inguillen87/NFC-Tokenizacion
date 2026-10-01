# SUN: menos CSS en la entrada del TAP, sin cambiar el pasaporte

## Problema medido
La raíz de la web importaba `globals.css` en todas las rutas: 1,82 MB de fuente, incluidas miles de reglas de landing, Demo Lab y otras presentaciones no usadas por SUN. La entrada al pasaporte descargaba ese conjunto antes del primer render. El problema se separa de validación criptográfica, adquisición GPS y carga del worker del mapa.

## Implementación
La raíz conserva solamente el reset y los temas base. SUN recibe una derivación conservadora de la misma fuente; cada rama de páginas no SUN sigue importando `globals.css` completo. No se movieron rutas, no se modificó el contenido del archivo original ni se cambiaron declaraciones, colores o tipografía del pasaporte.

La derivación quita una regla sólo si todos sus selectores exigen una familia explícita de marketing que no aparece en las fuentes conservadoras de SUN y UI compartida. Selectores genéricos, desconocidos, negaciones, `:has`, mezclas con SUN y familias referenciadas se conservan. Se preservan condiciones media/supports, orden de declaraciones y todas las animaciones. Si una familia pasa a usarse en SUN, vuelve automáticamente al conjunto conservado. Un control de presupuesto impide aceptar aumentos silenciosos.

`globals.css` continúa siendo la única fuente editable. Los archivos derivados se regeneran en dev/build y no se versionan. Los test recorren todas las páginas no SUN para comprobar que sigan heredando sus estilos completos. No hay una descarga tardía dependiente de JavaScript para maquillar un primer render sin estilos.

## Validación local
743 pruebas web aprobadas (23 nuevas), TypeScript, 173 contratos SUN, custodia de secretos y auditoría. Compilación Next de producción con instalación limpia aprobada.

La prueba de navegador utiliza ese build real y una respuesta de snapshot rechazada/sintética: su servidor bloquea consultas externas. Se comparan los estilos calculados de 342 elementos visibles usando el CSS completo y el reducido en ocho combinaciones de ancho/tema: 320, 390, 768 y 1.440 px; claro y oscuro. No se encontraron diferencias de los atributos comparados ni desbordamientos. Se recorre además la navegación real hacia el acceso a productos y el regreso al pasaporte; seis rutas del sitio conservan el CSS completo. El estudio comprueba conservación visual, no autenticidad de una lectura física.

En ese build, el stylesheet principal baja de 229.415 a 109.138 bytes con la misma compresión gzip. Es el tamaño comprimido de ese recurso, no el tiempo completo del TAP. Las mediciones sobre producción antes/después y la publicación se registran al cerrar, sin anticipar un porcentaje de mejora en el teléfono del cliente.

## Alcance y límites
El código de API, de SUN, del mapa, sus créditos y controles, la ubicación consentida y el dashboard permanecen intactos. No hay cambios de dependencias, migraciones, claves NFC, permisos ni datos de clientes. Los estilos completos siguen disponibles al navegar por el resto del sitio; la mejora se centra en una entrada fría directamente a SUN.

Referencia de integración de CSS por rutas y orden de importación: https://nextjs.org/docs/app/getting-started/css . Se prueba la compilación de producción, no sólo el servidor de desarrollo.

## Comparación de estilos en CI
El primer ensayo de CI detectó una diferencia transitoria de color al reemplazar la hoja de referencia: el propio ensayo retiraba el CSS activo mientras descargaba el completo. Se cambió esa maniobra por una sustitución atómica: primero carga la referencia sin aplicarla, luego la activa en el mismo lugar y retira la anterior. Las aserciones de igualdad y el presupuesto no se relajaron; se vuelve a ejecutar el conjunto sobre el commit corregido. Esta modificación afecta al comparador, no al CSS ni a los componentes productivos.
