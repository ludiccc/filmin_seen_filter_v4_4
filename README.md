# Filmin Seen Filter

Extensión para Brave y Chrome que permite ocultar o atenuar títulos ya vistos en [Filmin España](https://www.filmin.es/) y filtrar el catálogo por valoración mínima.

Proyecto independiente, sin afiliación, patrocinio ni aprobación de Filmin.

## Funciones

- Ocultar o atenuar títulos de tu lista de vistos.
- Agregar o quitar títulos con el botón de cada tarjeta, sin modificar el historial de tu cuenta de Filmin.
- Cargar una lista manual o importar tu propio historial desde la página de Filmin.
- Ocultar títulos cuya valoración detectada sea inferior al umbral elegido. Los títulos sin valoración detectada permanecen visibles.
- Guardar las preferencias y la lista en el navegador.

## Instalación

1. Descargá este repositorio desde **Code → Download ZIP** y descomprimilo, o clonalo:

   ```sh
   git clone https://github.com/ludiccc/filmin_seen_filter_v4_4.git
   ```

2. Abrí `brave://extensions/` o `chrome://extensions/`.
3. Activá **Modo desarrollador**.
4. Pulsá **Cargar descomprimida**.
5. Seleccioná la carpeta que contiene `manifest.json`.
6. Abrí o recargá `https://www.filmin.es/`.

No requiere compilación ni dependencias externas. La versión declarada en el manifiesto es **1.2.4**; el nombre del repositorio no corresponde a la versión de la extensión.

## Uso

### Lista manual

Abrí las opciones de la extensión, pegá tu lista y guardá los cambios. Se aceptan:

- Un título por línea.
- Un array JSON: `["Aftersun", "Perfect Days"]`.
- Una línea separada por comas: `Aftersun, Perfect Days`.
- Títulos separados por punto y coma.

La comparación ignora mayúsculas, acentos y algunos signos. Desde el popup podés activar el filtro y elegir entre ocultar y atenuar.

### Importar tu historial

Iniciá sesión normalmente en Filmin y pulsá **Cargar historial de la página de Filmin** en el popup. La extensión abre o reutiliza `https://www.filmin.es/historial`, desplaza la página automáticamente y agrega los títulos detectados a tu lista local, evitando duplicados.

Usá esta función únicamente con tu propia cuenta y acceso autorizado. El desplazamiento puede provocar que Filmin cargue más páginas de tu historial. La importación tiene un límite de iteraciones y puede quedar incompleta.

### Valoración mínima

Activá el filtro de valoración en el popup y elegí el umbral. La extensión intenta obtener la nota del HTML, de componentes de la página y de datos incluidos en sus scripts. La detección es heurística y puede fallar o asociar una nota incorrecta.

## Privacidad y permisos

La extensión guarda la lista, las preferencias y el estado de importación en `chrome.storage.local`, sin sincronizarlos mediante `storage.sync`. No incorpora analítica, servidores propios ni envíos de la lista a terceros. No solicita ni lee contraseñas o cookies de sesión.

- **storage**: guardar los datos de la extensión en el perfil del navegador.
- **tabs**: consultar las pestañas necesarias para localizar y abrir el historial y comunicarse con la página.
- **Acceso a `https://www.filmin.es/*`**: leer títulos y valoraciones, modificar la presentación local del catálogo e importar el historial. `main.js` se ejecuta en el contexto de la página para inspeccionar datos de sus componentes.

La página de Filmin mantiene su propio funcionamiento y sus comunicaciones habituales. Para borrar la lista, vaciá el campo de títulos en las opciones y pulsá **Guardar**. Desinstalar la extensión elimina su almacenamiento local.

## Limitaciones

- Solo se configura para `https://www.filmin.es/*`.
- Los cambios de HTML o componentes de Filmin pueden romper la detección.
- Títulos distintos con el mismo nombre pueden confundirse; nombres diferentes para una misma obra pueden no coincidir.
- La importación depende de una sesión válida y del contenido que la página cargue.

## Condiciones de Filmin

Revisión orientativa: **18 de noviembre de 2026**. Se consultaron el [aviso legal y las condiciones oficiales](https://www.filmin.es/aviso-legal) y su [versión HTML estática](https://static.filmin.es/apps/static_text/aviso_legal.html).

El apartado 4 del aviso legal exige autorización para explotar elementos del sitio. No se encontró una prohibición específica de publicar extensiones como esta, pero eso no equivale a autorización. La importación automática del historial y la inspección de datos de la página presentan incertidumbre contractual. Para despejarla, solicitá autorización escrita a Filmin antes de utilizar esas funciones.

El repositorio distribuye código de la extensión, sin películas, carteles, logotipos ni historiales personales. No elude pagos, DRM o restricciones geográficas ni facilita compartir cuentas. Esta revisión no es un dictamen jurídico ni garantiza conformidad contractual.

## Autor y contacto

**Federico Joselevich Puiggrós**

GitHub: [@ludiccc](https://github.com/ludiccc)

Correo: [f@ludic.cc](mailto:f@ludic.cc)

Para informar errores o proponer mejoras, abrí un [issue](https://github.com/ludiccc/filmin_seen_filter_v4_4/issues). No publiques credenciales ni tu historial personal.

## Licencia

Copyright (c) 2026 Federico Joselevich Puiggrós.

Código y documentación bajo la [licencia MIT](LICENSE). Permite usar, modificar y redistribuir el proyecto, incluso comercialmente, conservando el aviso de copyright y la licencia. Se proporciona sin garantías.

La licencia abarca los derechos del autor sobre este proyecto; no concede derechos sobre las marcas, los contenidos o los servicios de Filmin ni sustituye sus condiciones de uso.
