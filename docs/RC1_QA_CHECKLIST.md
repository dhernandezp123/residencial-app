# ResidentPass RC1 QA Checklist

Checklist manual para validar ResidentPass antes de una demostración comercial.

Estados permitidos: `PENDIENTE`, `PASÓ`, `FALLÓ`, `BLOQUEADO`.

| ID | Rol | Flujo | Pasos | Resultado esperado | Estado | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| ANO-001 | Anónimo | Landing | Abrir `/` en móvil y desktop. | La landing carga sin errores, sin scroll horizontal y con CTA claro hacia login/registro. | PENDIENTE |  |
| ANO-002 | Anónimo | Login | Abrir `/login`, ingresar credenciales inválidas y luego válidas. | Muestra error claro con credenciales inválidas; con credenciales válidas redirige al dashboard correcto. | PENDIENTE |  |
| ANO-003 | Anónimo | Link de invitación válido | Abrir un link de invitación vigente de residencial/casa. | El formulario de registro muestra residencial/casa correctos y permite continuar. | PENDIENTE |  |
| ANO-004 | Anónimo | Link de invitación inválido | Abrir un link con token/código inválido o inexistente. | Muestra mensaje claro de link inválido y opción de volver/login. | PENDIENTE |  |
| ANO-005 | Anónimo | Registro con casa válida | Completar registro con casa válida, seguridad activa y cupo disponible. | Solicitud se crea correctamente y queda pendiente de aprobación. | PENDIENTE |  |
| ANO-006 | Anónimo | Registro con casa sin seguridad | Intentar registrarse en una casa con seguridad desactivada. | El sistema bloquea o explica que la casa no está habilitada para uso de la app. | PENDIENTE |  |
| ANO-007 | Anónimo | Registro con cupo lleno | Intentar registrarse en una casa que ya alcanzó el cupo de residentes app. | El sistema impide crear la solicitud y muestra mensaje claro. | PENDIENTE |  |
| RES-001 | Residente | Login | Iniciar sesión con residente aprobado. | Redirige a `/dashboard` con acciones principales visibles. | PASÓ | Validado QA manual. |
| RES-002 | Residente | Crear visita | Desde dashboard tocar Visita, llenar nombre y vencimiento, crear. | Se crea visita, aparece QR, botón compartir imagen y fallback de link. | PASÓ | Validado QA manual. |
| RES-003 | Residente | Crear delivery | Desde dashboard tocar Delivery, revisar tipo prellenado, crear. | Se crea delivery con vencimiento sugerido de 2 horas y QR compartible. | PASÓ | Validado QA manual. |
| RES-004 | Residente | Crear evento | Desde dashboard tocar Evento, crear evento con varios invitados. | Se crea evento, invitados quedan registrados y se genera un solo QR del evento. | PASÓ | Validado QA manual. |
| RES-005 | Residente | Compartir QR imagen | En QR de visita y evento tocar Compartir imagen QR. | En dispositivo compatible abre share sheet; si no, descarga imagen o mantiene fallback. | PASÓ | Validado QA manual. |
| RES-006 | Residente | Ver mis visitas | Abrir `/dashboard/visits`. | Lista visitas en cards, muestra estado correcto, QR activo y empty state si no hay datos. | PASÓ | Validado QA manual. |
| RES-007 | Residente | Ver mis eventos | Abrir `/dashboard/events`. | Lista eventos con fecha, cantidad de invitados, estado y acción para ver/compartir QR. | PASÓ | Validado QA manual. |
| RES-008 | Residente | Notificaciones | Abrir `/dashboard/notifications`. | Muestra notificaciones, permite marcar leídas y muestra empty state profesional si no hay. | PASÓ | Validado QA manual. |
| RES-009 | Residente | Mi casa | Abrir `/dashboard/my-house`. | Muestra información de casa, residentes aprobados y datos relacionados sin exponer otra casa. | PASÓ | Validado QA manual. |
| RES-010 | Residente | Activar PWA/push | Instalar app o abrir desde navegador compatible y activar notificaciones. | Solicita permisos, guarda suscripción y oculta aviso si ya están activas. | PASÓ | Validado QA manual. |
| RES-011 | Residente | Cerrar sesión | Usar botón Salir del header. | Cierra sesión y redirige a login sin mantener acceso al dashboard. | PASÓ | Validado QA manual. |
| GUA-001 | Guardia | Login | Iniciar sesión con guardia aprobado. | Redirige al dashboard/flujo de guardia permitido. | PASÓ | Validado QA manual. |
| GUA-002 | Guardia | Escanear QR visita | Abrir `/gate/scan` y escanear QR activo de visita. | Valida QR, muestra visitante, casa, residente y acciones disponibles. | PASÓ | Validado QA manual. |
| GUA-003 | Guardia | Evidencia obligatoria | Intentar registrar ingreso sin evidencia requerida. | El sistema bloquea el ingreso e indica la evidencia faltante. | PASÓ | Validado QA manual. |
| GUA-004 | Guardia | Registrar ingreso | Escanear QR válido, cargar evidencia requerida y registrar ingreso. | Se registra entrada, se guardan evidencias y aparece confirmación. | PASÓ | Validado QA manual. |
| GUA-005 | Guardia | Registrar salida | Escanear visita dentro y registrar salida con confirmación si aplica. | Se registra salida y el visitante deja de aparecer como dentro. | PASÓ | Validado QA manual. |
| GUA-006 | Guardia | QR vencido | Escanear QR con `expires_at` vencido. | Muestra error claro de QR vencido y no registra acceso. | PASÓ | Validado QA manual. |
| GUA-007 | Guardia | QR usado | Escanear QR single-use ya usado. | Muestra error claro de QR usado/no disponible y no registra nuevo ingreso. | PASÓ | Validado QA manual. |
| GUA-008 | Guardia | QR evento | Abrir `/gate/event-scan?token=<token>` con QR de evento activo. | Muestra evento, casa, anfitrión y lista de invitados. | PASÓ | Validado QA manual. |
| GUA-009 | Guardia | Entrada/salida por invitado | En evento registrar ingreso de un invitado y luego salida. | Cambia estado por invitado, sin registrar el evento completo de una vez. | PASÓ | Validado QA manual. |
| GUA-010 | Guardia | Entradas recientes | Abrir `/dashboard/entries`. | Muestra últimas entradas en cards con estado Dentro/Salió y empty state si no hay. | PASÓ | Validado QA manual; corregido para incluir entradas de eventos agrupadas por evento. |
| GUA-011 | Guardia | Personas dentro | Abrir `/dashboard/inside`. | Lista visitantes sin salida registrada y respeta residencial del guardia. | PASÓ | Validado QA manual. |
| GUA-012 | Guardia | Cerrar sesión | Usar acción de salir/logout disponible. | Cierra sesión y bloquea acceso posterior a rutas protegidas. | PASÓ | Validado QA manual. |
| ADM-001 | Admin | Dashboard admin | Iniciar sesión como admin y abrir `/dashboard/admin`. | Dashboard carga en menos de 5 segundos con KPIs, activity feed y acciones rápidas. | PASÓ | Validado QA manual. |
| ADM-002 | Admin | KPIs | Revisar cards de Casas, Casas activas, Residentes, Visitas, Personas dentro, Eventos y Comprobantes. | Cada KPI muestra conteo correcto para el residencial del admin. | PASÓ | Validado QA manual. |
| ADM-003 | Admin | Activity feed | Revisar timeline de últimas actividades. | Muestra hasta 20 actividades mezcladas, ordenadas por fecha descendente. | PASÓ | Validado QA manual. |
| ADM-004 | Admin | Aprobar/rechazar residentes | Abrir residentes, aprobar y rechazar solicitudes con confirmación. | Cambia estado correctamente, muestra toast corto y no permite acción accidental de un tap. | PASÓ | Validado QA manual. |
| ADM-005 | Admin | Casas | Abrir `/dashboard/houses` y detalle de una casa. | Lista casas del residencial, muestra estados y detalle sin datos de otra residencial. | PASÓ | Validado QA manual. |
| ADM-006 | Admin | Activar/desactivar seguridad | Cambiar estado de seguridad de una casa con confirmación. | Estado cambia, mensajes son claros y rutas de visita respetan casa sin seguridad. | PASÓ | Validado QA manual; agregada notificación interna al residente cuando la seguridad se activa o queda inactiva por falta de pago. |
| ADM-007 | Admin | Guardias | Abrir `/dashboard/guards`, crear/editar guardia si aplica. | Operaciones permitidas funcionan y no exponen guardias de otra residencial. | PASÓ | Validado QA manual. |
| ADM-008 | Admin | Entradas recientes | Abrir `/dashboard/entries` como admin. | Muestra accesos del residencial administrado, con filtros/estado visual correctos. | PENDIENTE | Corregido para reconocer usuarios Resident + Admin mediante `is_residential_admin`; revalidar en deploy. |
| ADM-009 | Admin | Personas dentro | Abrir `/dashboard/inside` como admin. | Muestra únicamente personas dentro del residencial administrado. | PENDIENTE | Corregido para reconocer usuarios Resident + Admin mediante `is_residential_admin`; revalidar en deploy. |
| SUP-001 | SuperAdmin | Crear residencial | Iniciar sesión como superadmin y crear un residencial. | Residencial se crea con datos requeridos y aparece en listado. | PENDIENTE |  |
| SUP-002 | SuperAdmin | Copiar link de invitación | Copiar link de registro/invitación de un residencial/casa. | Link se copia, abre formulario correcto y no contiene datos sensibles innecesarios. | PENDIENTE |  |
| SUP-003 | SuperAdmin | Ver residenciales | Abrir `/dashboard/residentials`. | Lista residenciales disponibles para superadmin con estados correctos. | PENDIENTE |  |
| SUP-004 | SuperAdmin | Dashboard global | Revisar dashboard administrativo/global. | Puede ver métricas globales cuando corresponda, sin romper filtros por residencial en pantallas específicas. | PENDIENTE |  |
| SUP-005 | SuperAdmin | Acceso global controlado | Entrar a pantallas de residentes, casas, guardias y residenciales. | Acceso global funciona solo para superadmin y acciones sensibles piden confirmación. | PENDIENTE |  |
| SEG-001 | Seguridad | Residente no accede a guard/admin | Con sesión residente abrir rutas de guardia/admin manualmente por URL. | Acceso denegado o redirección segura; no se muestran datos protegidos. | PENDIENTE |  |
| SEG-002 | Seguridad | Guardia no accede a admin | Con sesión guardia abrir `/dashboard/admin`, `/dashboard/residents`, `/dashboard/guards`. | Acceso denegado o redirección segura. | PENDIENTE |  |
| SEG-003 | Seguridad | Admin no ve otra residencial | Con admin de residencial A intentar consultar datos de residencial B por URL o filtros. | RLS/queries bloquean datos ajenos; UI no los muestra. | PENDIENTE |  |
| SEG-004 | Seguridad | QR single-use no se reutiliza | Registrar ingreso con QR single-use y luego intentar reutilizarlo. | Segundo intento queda bloqueado como usado/no disponible. | PENDIENTE |  |
| SEG-005 | Seguridad | Multi-use funciona hasta vencimiento | Crear visita multi-use y registrar múltiples accesos antes del vencimiento. | Permite usos válidos hasta vencimiento y bloquea después. | PENDIENTE |  |
| SEG-006 | Seguridad | Casa sin seguridad no genera visitas | Desactivar seguridad de casa y crear visita como residente de esa casa. | Flujo bloquea creación o muestra mensaje claro. | PENDIENTE |  |
| SEG-007 | Seguridad | Endpoints server-side bloquean roles incorrectos | Probar endpoints admin/gate con usuario sin rol correcto. | Endpoints responden error autorizado/forbidden y no modifican datos. | PENDIENTE |  |
| PWA-001 | PWA/Push | Instalar en iPhone | Abrir app en Safari iOS y agregar a pantalla de inicio. | App abre en modo PWA, sin barras innecesarias y con navegación usable. | PENDIENTE |  |
| PWA-002 | PWA/Push | Instalar en Android | Abrir app en Chrome Android e instalar. | App se instala y abre en modo standalone. | PENDIENTE |  |
| PWA-003 | PWA/Push | Activar notificaciones | Desde residente activar notificaciones push. | Permiso se solicita, se guarda suscripción y se muestra confirmación. | PENDIENTE |  |
| PWA-004 | PWA/Push | Crear push subscription | Verificar en backend/base que la suscripción push queda asociada al usuario correcto. | Existe suscripción válida, sin duplicados innecesarios. | PENDIENTE |  |
| PWA-005 | PWA/Push | Notificación interna al entrar/salir | Registrar ingreso y salida de visitante. | Residente recibe notificación interna/push según permisos y configuración. | PENDIENTE |  |
| PWA-006 | PWA/Push | Cron de visita por vencer | Ejecutar o esperar cron de visita por vencer. | Se envían notificaciones esperadas sin duplicar avisos. | PENDIENTE |  |
| STO-001 | Storage | Fotos identidad/vehículo/placa suben | En guardia registrar ingreso con todas las evidencias. | Fotos suben correctamente a storage y se muestran/registran sin error. | PENDIENTE |  |
| STO-002 | Storage | Paths se guardan | Revisar registro de entrada generado. | Paths de identidad, vehículo y placa quedan guardados en columnas esperadas. | PENDIENTE |  |
| STO-003 | Storage | Fallo de upload no registra ingreso | Simular fallo de storage/red durante upload de evidencia. | El ingreso no se registra parcialmente y muestra error claro. | PENDIENTE |  |