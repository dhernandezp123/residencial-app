# AGENTS.md

## Propósito

Este documento define las reglas técnicas y arquitectónicas para cualquier IA o desarrollador que participe en el proyecto.

---

# Principios Generales

1. Seguridad primero.
2. Escalabilidad antes que rapidez.
3. Multi-residencial desde el diseño inicial.
4. No crear soluciones temporales que generen deuda técnica.
5. Mantener consistencia con el stack seleccionado.


### PRINCIPIO ARQUITECTÓNICO #1

Este sistema debe diseñarse desde el inicio como una plataforma
multi-residencial (multi-tenant).

Aunque inicialmente opere para un solo residencial,
ninguna decisión técnica debe asumir que existirá
un único residencial.
---

# Stack Oficial

* Next.js 16
* React
* TypeScript
* Tailwind CSS
* Supabase
* PostgreSQL

No introducir frameworks adicionales sin justificación.

---

# Arquitectura

El sistema debe diseñarse desde el inicio para soportar múltiples residenciales.

Toda entidad debe pertenecer a un residencial.

Ejemplo:

residentials
└── houses
└── profiles
└── visits
└── visitor_entries

---

# Roles

## admin

Acceso completo.

## resident

Generación y administración de visitas.

## guard

Validación de accesos y registro de ingresos.

---

# Convenciones

## TypeScript

Siempre utilizar tipado explícito.

Evitar:

any

Preferir:

interfaces
types

---

## Base de Datos

Toda tabla debe incluir:

* id
* created_at
* updated_at

Siempre usar UUID.

---

## Supabase

No utilizar Service Role Key en frontend.

Toda lógica sensible debe estar protegida mediante RLS.

---

## Seguridad

Los QR deben utilizar UUIDs únicos.

Nunca almacenar información sensible dentro del QR.

El QR únicamente contendrá un identificador único.

---

# Fases del Proyecto

## Fase 1

Arquitectura base

* residentials
* houses
* profiles

## Fase 2

Visitas

* visits
* qr_tokens

## Fase 3

Control de acceso

* visitor_entries
* visitor_photos

## Fase 4

RLS

* Roles
* Policies
* Auditoría

## Fase 5

Reportería

* Dashboard
* KPIs

## Fase 6

SaaS

* Multi-residencial
* Suscripciones
* Facturación

---

# Restricciones

No eliminar tablas existentes sin migración.

No modificar estructura de producción sin script SQL versionado.

Toda migración debe quedar documentada.

---

# Objetivo Final

Construir una plataforma SaaS de control de acceso residencial basada en QR, preparada para operar múltiples residenciales con altos estándares de seguridad, trazabilidad y auditoría.
