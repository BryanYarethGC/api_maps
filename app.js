// Declaración de variables globales
let map;
let directionsService; 
let directionsRenderer; 
const resultsDiv = document.getElementById("results");
const errorDiv = document.getElementById("error-message");
const waypointsContainer = document.getElementById("waypoints-container");
const routeSelector = document.getElementById("route-selector");
const routeSelectionArea = document.getElementById("route-selection-area");

let waypointCount = 0; // Contador para gestionar el ID de los waypoints
let lastDirectionsResponse = null; // Almacena la última respuesta completa de la API
let availableRoutes = []; // Array para almacenar las rutas alternativas ordenadas

// Coordenadas del centro de SLP para la preferencia de búsqueda (Viewport Bias)
const SLP_BOUNDS = {
    north: 22.18,
    south: 22.11,
    west: -101.05,
    east: -100.95,
};

/**
 * Función que aplica el servicio de Autocompletado de Direcciones a un input, 
 * con preferencia por SLP.
 */
function initAutocomplete(inputElement) {
    if (google.maps.places && inputElement) {
        new google.maps.places.Autocomplete(inputElement, {
            // Preferencia de ubicación en SLP
            bounds: SLP_BOUNDS, 
            strictBounds: false, // Permite resultados fuera, pero prioriza dentro.
            componentRestrictions: { country: ["mx"] }, 
            fields: ["name"],
            types: ["geocode"]
        });
    }
}

/**
 * Función de inicialización del mapa y event listeners. 
 */
function initMap() {
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        polylineOptions: {
            strokeColor: '#0d6efd', 
            strokeOpacity: 0.8,
            strokeWeight: 6
        }
    });

    const initialLocation = { lat: 22.1564, lng: -100.9855 }; // Centro de SLP

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12, 
        center: initialLocation, 
    });

    directionsRenderer.setMap(map);
    directionsRenderer.setPanel(document.getElementById("directions-panel"));

    // Conectar botones y selector
    document.getElementById("calculate-route-btn").addEventListener("click", calculateRoute);
    document.getElementById("add-waypoint-btn").addEventListener("click", addWaypointInput);
    routeSelector.addEventListener("change", displaySelectedRoute); // Evento para cambiar la ruta mostrada
    
    // Inicializar Autocompletado para Origen y Destino
    initAutocomplete(document.getElementById("origin-input"));
    initAutocomplete(document.getElementById("destination-input"));

    // Inicializar la interfaz
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = "Ingresa Origen, Destino, y paradas intermedias para buscar rutas alternativas.";
    errorDiv.style.display = 'none';
    routeSelectionArea.style.display = 'none';
}

/**
 * Añade dinámicamente un campo de entrada para un punto intermedio y le aplica Autocompletado.
 */
function addWaypointInput() {
    waypointCount++;

    const inputId = `waypoint-${waypointCount}`;

    const newWaypoint = document.createElement('div');
    newWaypoint.className = 'input-group waypoint-input-group';
    newWaypoint.id = `waypoint-group-${waypointCount}`;
    
    newWaypoint.innerHTML = `
        <input type="text" id="${inputId}" class="form-control address-input" 
            placeholder="${waypointCount + 1}. Parada Intermedia">
        <button class="btn btn-outline-danger" type="button" 
                onclick="removeWaypointInput(${waypointCount})">
            -
        </button>
    `;
    
    waypointsContainer.appendChild(newWaypoint);

    // Aplicar el Autocompletado al nuevo campo de entrada
    initAutocomplete(document.getElementById(inputId));
}

/**
 * Elimina el campo de entrada del punto intermedio especificado.
 */
function removeWaypointInput(id) {
    const elementToRemove = document.getElementById(`waypoint-group-${id}`);
    if (elementToRemove) {
        waypointsContainer.removeChild(elementToRemove);
    }
}

/**
 * Función auxiliar para mostrar las métricas de una ruta en el panel.
 */
function displayRouteMetrics(metrics, title) {
    resultsDiv.classList.remove('alert-danger', 'alert-info');
    resultsDiv.classList.add('alert-success');
    resultsDiv.innerHTML = `
        <h5 class="alert-heading">✅ ${title}</h5>
        <p>Distancia Total: <strong>${metrics.distanceInKm}</strong></p>
        <p>Tiempo Estimado Total de Viaje: <strong>${metrics.durationText}</strong></p>
        <small class="text-muted">${metrics.numLegs} tramos calculados.</small>
    `;
    resultsDiv.style.display = 'block';
}

/**
 * Función que maneja la selección de rutas alternativas en el dropdown.
 */
function displaySelectedRoute() {
    // El valor del selector es el índice de la ruta dentro de la respuesta de la API.
    const selectedRouteIndex = parseInt(routeSelector.value); 
    
    if (lastDirectionsResponse && selectedRouteIndex >= 0) {
        // 1. Dibuja la ruta correcta usando la propiedad routeIndex
        directionsRenderer.setDirections(lastDirectionsResponse); 
        directionsRenderer.setRouteIndex(selectedRouteIndex); 

        // 2. Extrae las métricas de la ruta seleccionada para mostrar en el panel
        const route = lastDirectionsResponse.routes[selectedRouteIndex];
        
        let totalDistance = 0;
        let totalDuration = 0;
        
        route.legs.forEach(leg => {
            totalDistance += leg.distance.value; 
            totalDuration += leg.duration.value; 
        });
        
        const distanceInKm = (totalDistance / 1000).toFixed(2) + ' km';
        const durationInHours = Math.floor(totalDuration / 3600);
        const durationInMinutes = Math.floor((totalDuration % 3600) / 60);
        
        let durationText = "";
        if (durationInHours > 0) durationText += `${durationInHours} hr `
        durationText += `${durationInMinutes} min`;

        const metrics = {
            distanceInKm: distanceInKm,
            durationText: durationText,
            numLegs: route.legs.length
        };

        displayRouteMetrics(metrics, `Ruta ${selectedRouteIndex + 1} seleccionada`);
    }
}


/**
 * Función principal para solicitar la ruta a la Directions API con alternativas.
 */
function calculateRoute() {
    // 1. Limpieza inicial
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    routeSelectionArea.style.display = 'none';
    routeSelector.innerHTML = '';
    availableRoutes = [];
    lastDirectionsResponse = null; 

    // 2. Obtener valores y waypoints
    const origin = document.getElementById("origin-input").value.trim();
    const destination = document.getElementById("destination-input").value.trim();
    
    const waypointInputs = waypointsContainer.querySelectorAll('input[type="text"]');
    
    const waypoints = Array.from(waypointInputs)
        .map(input => ({ location: input.value.trim(), stopover: true }))
        .filter(wp => wp.location);

    if (!origin || !destination) {
        errorDiv.textContent = "⚠️ ERROR: Debes ingresar al menos la dirección de origen y destino.";
        errorDiv.style.display = 'block';
        return;
    }

    // 3. Objeto de solicitud con alternativas activadas
    const request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints, 
        optimizeWaypoints: true, 
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true 
    };

    // 4. Llamada al servicio Directions API
    directionsService.route(request, (response, status) => {
        if (status === "OK") {
            lastDirectionsResponse = response; 
            
            // 5. Iterar, calcular métricas y ordenar rutas por duración
            response.routes.forEach((route, index) => {
                let totalDistance = 0;
                let totalDuration = 0;
                
                route.legs.forEach(leg => {
                    totalDistance += leg.distance.value; 
                    totalDuration += leg.duration.value; 
                });
                
                const distanceInKm = (totalDistance / 1000).toFixed(2) + ' km';
                const durationInHours = Math.floor(totalDuration / 3600);
                const durationInMinutes = Math.floor((totalDuration % 3600) / 60);
                let durationText = (durationInHours > 0 ? `${durationInHours} hr ` : '') + `${durationInMinutes} min`;

                availableRoutes.push({
                    originalIndex: index, // Índice real en la respuesta de la API
                    metrics: { totalDuration: totalDuration }, 
                    display: `Ruta ${index + 1}: ${durationText} (${distanceInKm})`
                });
            });

            // 6. Ordenar por duración (la más rápida primero)
            availableRoutes.sort((a, b) => a.metrics.totalDuration - b.metrics.totalDuration);
            
            // 7. Llenar el selector
            availableRoutes.forEach((route, index) => {
                const option = document.createElement('option');
                option.value = route.originalIndex; 
                option.textContent = route.display;
                routeSelector.appendChild(option);
            });
            
            // 8. Mostrar el selector y renderizar la mejor ruta
            routeSelectionArea.style.display = 'block';
            routeSelector.value = availableRoutes[0].originalIndex; 
            displaySelectedRoute();
            
        } else {
            // 9. Manejo de errores 
            let errorMessage = "No se pudo calcular la ruta.";
            if (status === "NOT_FOUND" || status === "ZERO_RESULTS") {
                errorMessage = "ERROR: No se encontró ruta. Verifica las direcciones y usa el autocompletado.";
            } else {
                errorMessage = `ERROR de servicio: ${status}.`;
            }
            
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            directionsRenderer.setDirections({routes: []}); 
        }
    });
}