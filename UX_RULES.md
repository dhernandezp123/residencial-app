# UX_RULES.md

## Filosofía General

Residencial Access está diseñado para uso principalmente desde teléfonos móviles.

Toda decisión de UX debe priorizar:

1. Velocidad
2. Claridad
3. Simplicidad
4. Uso con una sola mano
5. Usuarios no técnicos

Nunca diseñar primero para desktop.

Mobile-first es obligatorio.

---

## Formularios

### Labels

Todos los inputs deben tener labels visibles.

Incorrecto:

* Placeholder como única referencia

Correcto:

Label visible
+
Placeholder opcional

Ejemplo:

Lote / Bloque
[ C ]

Número de casa
[ 24 ]

---

### Helper Text

Todo campo que pueda generar dudas debe incluir explicación.

Ejemplos:

Máximo usuarios app por casa

Cantidad máxima de residentes aprobados que podrán utilizar la aplicación para anunciar visitas.

No limita la cantidad de visitas.

---

### Inputs

Altura mínima:

48px

Recomendado:

52px

Bordes redondeados consistentes.

Área táctil cómoda.

---

### Botones

Botones primarios:

* Ancho completo
* Altura mínima 48px
* Texto claro
* Alto contraste

Evitar botones pequeños.

---

## Feedback

### Prohibido

window.alert()

### Obligatorio

Sonner

Tipos:

* toast.success()
* toast.error()
* toast.warning()

---

## Navegación

Evitar más de 3 niveles de profundidad.

Jerarquía ideal:

Residenciales
→ Casas
→ Residentes

o

Visitas
→ Detalle

---

## Listados

En móvil usar Cards.

Evitar tablas.

Cada entidad debe verse como una tarjeta.

Ejemplo:

Residencial Rancho San Manuel

San Pedro Sula

Activo

---

## Estados

Toda acción debe mostrar estado visual.

Ejemplos:

Guardando...
Cargando...
Procesando...

Nunca dejar al usuario sin feedback.

---

## Colores

Verde:
Estados correctos

Rojo:
Errores

Ámbar:
Advertencias

Gris:
Información secundaria

---

## Accesibilidad

No depender únicamente del color.

Siempre acompañar color con texto.

Correcto:

Activo

Incorrecto:

Solo un punto verde

---

## Regla Principal

Si un usuario necesita capacitación para entender una pantalla:

La pantalla está mal diseñada.

La interfaz debe explicarse por sí sola.
