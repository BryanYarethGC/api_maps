// Declaración de variables globales para los objetos de la API de Google Maps
let map;
let directionsService; 
let directionsRenderer; 
const resultsDiv = document.getElementById("results");
const errorDiv = document.getElementById("error-message");

/**
 * Función de inicialización del mapa. 
 * (Fase 2.1 - RF-01)
 */
function initMap() {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        // Personalizar el color de la ruta para que coincida con Bootstrap Primary
        polylineOptions: {
            strokeColor: '#0d6efd', 
            strokeOpacity: 0.8,
            strokeWeight: 6
        }
    });

    const initialLocation = { lat: 22.1564, lng: -100.9855 }; // Ejemplo: San Luis Potosí

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12, 
        center: initialLocation, 
    });

    directionsRenderer.setMap(map);

    document.getElementById("calculate-route-btn").addEventListener("click", calculateRoute);
    
    // Inicializar la interfaz (solo el mensaje de ayuda es visible al inicio)
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = "Ingresa Origen y Destino para calcular la ruta.";
    errorDiv.style.display = 'none';
}

/**
 * Función principal para solicitar la ruta a la Directions API.
 * (Fase 3.1, RF-04)
 */
function calculateRoute() {
    // 1. Limpiar resultados/errores previos
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    // Obtener valores de los campos de texto
    const origin = document.getElementById("origin-input").value;
    const destination = document.getElementById("destination-input").value;

    // 2. Validación (RF-07)
    if (!origin || !destination) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = "⚠️ ERROR: Debes ingresar la dirección de origen y destino.";
        return;
    }

    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING 
    };

    // 3. Llamada al servicio Directions API
    directionsService.route(request, (response, status) => {
        if (status === "OK") {
            // Éxito: renderizar la ruta (RF-05)
            directionsRenderer.setDirections(response);

            // Extraer y mostrar métricas (RF-06)
            const route = response.routes[0].legs[0];
            const distance = route.distance.text;
            const duration = route.duration.text;
            
            // Mostrar resultados en el div con el estilo Bootstrap
            resultsDiv.classList.remove('alert-danger');
            resultsDiv.classList.add('alert-success');
            resultsDiv.innerHTML = `
                <h5 class="alert-heading">✅ Ruta Encontrada</h5>
                <p>Distancia Total: <strong>${distance}</strong></p>
                <p>Tiempo Estimado de Viaje: <strong>${duration}</strong></p>
            `;
            resultsDiv.style.display = 'block';

        } else {
            // Manejo de errores (RF-07)
            let errorMessage = "No se pudo calcular la ruta.";
            if (status === "NOT_FOUND" || status === "ZERO_RESULTS") {
                errorMessage = "❌ ERROR: No se encontró una ruta válida. Verifica las direcciones.";
            } else {
                errorMessage = `❌ ERROR de servicio: ${status}. Asegúrate de que las APIs estén activas.`;
            }
            
            // Mostrar error en el div de error
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            
            // Limpiar la visualización anterior de la ruta
            directionsRenderer.setDirections({routes: []}); 
        }
    });
}