# Residencial Access Control

Sistema de control de acceso residencial basado en códigos QR para visitantes, residentes y personal de seguridad.

## Objetivo

Digitalizar el proceso de autorización y registro de visitas dentro de residenciales privadas mediante códigos QR temporales, permitiendo mayor seguridad, trazabilidad y control de accesos.

---

## Características Principales

### Residentes

* Registro de visitantes
* Generación de códigos QR temporales
* Configuración de fecha y hora de validez
* Cancelación de visitas
* Historial de visitas

### Guardias

* Escaneo de códigos QR
* Validación de autorización
* Registro de ingreso y salida
* Captura de fotografías:

  * Vehículo
  * Placa
  * Documento de identidad

### Administración

* Gestión de residenciales
* Gestión de viviendas
* Gestión de residentes
* Gestión de guardias
* Historial completo
* Reportes y auditoría

---

## Stack Tecnológico

### Frontend

* Next.js 16
* React
* TypeScript
* Tailwind CSS

### Backend

* Supabase
* PostgreSQL
* Supabase Auth
* Supabase Storage
* Row Level Security (RLS)

### Hosting

* Vercel

---

## Arquitectura General

residentials
└── houses
└── profiles
└── visits
└── visitor_entries
└── visitor_photos

---

## Roles

### Admin

Acceso total al sistema.

### Resident

Puede generar y administrar visitas.

### Guard

Puede validar accesos y registrar entradas/salidas.

---

## Roadmap

### Fase 1

* Login
* Registro
* Roles
* Residenciales
* Viviendas

### Fase 2

* Gestión de visitas
* Generación QR
* Escaneo QR

### Fase 3

* Registro de entradas
* Fotografías
* Historial

### Fase 4

* Seguridad avanzada
* RLS
* Auditoría

### Fase 5

* Reportes
* Dashboard
* Notificaciones

### Fase 6

* Multi-residencial SaaS
* Facturación
* Planes comerciales

---

## Estado Actual

Proyecto inicializado.

* Next.js creado
* GitHub conectado
* Supabase creado
* Arquitectura en definición
