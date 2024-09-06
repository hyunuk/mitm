// Initialize and add the map
let map;
let markers = [];
let directionsRenderer;

const initMap = async () => {
    //@ts-ignore
    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
    const { PlacesService } = await google.maps.importLibrary("places");

    // The map, centered at initial position (you might want to adjust this)
    map = new Map(document.getElementById("map"), {
        zoom: 5,
        center: { lat: 39.50, lng: -98.35 }, // San Francisco
        mapId: "DEMO_MAP_ID",
    });

    // Event listener for the "Find Midpoint" button
    document.getElementById("findMidpoint").addEventListener("click", findMidpoint);
};

const findMidpoint = async () => {
    const city = document.getElementById("city").value;

    clearRouteAndMarkers();
    document.getElementById("time").innerHTML = "";

    // Geocode the city using the Places API
    const placesService = new google.maps.places.PlacesService(map);
    placesService.textSearch({ query: city + ", USA" }, async (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) {
            document.getElementById("coordinates").InnerHTML = "<p>Could not find the specified city. Please try again.</p>";
            return;
        }
        const location = results[0];
        const { south, north, west, east } = getBoundingBox(location.geometry.viewport);

        // Generate two random coordinates within the bounding box
        const lat1 = getRandomCoordinate(south, north);
        const lon1 = getRandomCoordinate(west, east);
        const lat2 = getRandomCoordinate(south, north);
        const lon2 = getRandomCoordinate(west, east);

        // Calculate walking route
        const data = calculateRouteAndMidpoint(lat1, lon1, lat2, lon2);
        const responseData = await sendRequest(data);
        const mockData = [
            {
                "Location": {
                    "latitude": 37.7971898,
                    "longitude": -122.4218597
                },
                "Name": "Royal Ground Coffee"
            },
            {
                "Location": {
                    "latitude": 37.799309199999996,
                    "longitude": -122.42231019999998
                },
                "Name": "Fueling Station Cafe"
            },
            {
                "Location": {
                    "latitude": 37.796541999999995,
                    "longitude": -122.42205799999999
                },
                "Name": "Peet's Coffee"
            },
            {
                "Location": {
                    "latitude": 37.8021467,
                    "longitude": -122.42496929999999
                },
                "Name": "Cafe Le"
            },
            {
                "Location": {
                    "latitude": 37.8025685,
                    "longitude": -122.4251404
                },
                "Name": "First Cup Café"
            }
        ];
        if (responseData) {
            displayLocations(responseData);
        }

    });
};

const displayLocations = (locations) => {
    locations.forEach(location => {
        const position = {
            lat: location.Location.latitude,
            lng: location.Location.longitude
        };
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: position,
            title: location.Name,
        });
        markers.push(marker);
    });
};

const sendRequest = async data => {
    try {
        const response = await fetch("https://us-central1-hyunuk-ai-dev.cloudfunctions.net/function-2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log("Response from Cloud Function:", responseData);
        return responseData;
    } catch (error) {
        console.error("Error sending POST request:", error);
    }
};

const getBoundingBox = viewport => ({
    south: viewport.getSouthWest().lat(),
    north: viewport.getNorthEast().lat(),
    west: viewport.getSouthWest().lng(),
    east: viewport.getNorthEast().lng(),
});

const getRandomCoordinate = (min, max) => min + Math.random() * (max - min);

const calculateRouteAndMidpoint = (lat1, lon1, lat2, lon2) => {
    const directionsService = new google.maps.DirectionsService();
    const request = {
        origin: { lat: lat1, lng: lon1 },
        destination: { lat: lat2, lng: lon2 },
        travelMode: google.maps.TravelMode.WALKING,
    };

    directionsService.route(request, async (response, status) => {
            if (status !== "OK") {
                document.getElementById("coordinates").innerHTML = `<p>Could not find a walking route between the two points. Error: ${status}</p>`;
                return;
            }
            // Display route on map
            directionsRenderer = new google.maps.DirectionsRenderer();
            directionsRenderer.setMap(map);
            directionsRenderer.setDirections(response);

            const decodedPolyline = google.maps.geometry.encoding.decodePath(response.routes[0].overview_polyline);
            const midpointIndex = Math.floor(decodedPolyline.length / 2);
            const midLat = decodedPolyline[midpointIndex].lat();
            const midLng = decodedPolyline[midpointIndex].lng();

            displayMarkers(midLat, midLng);
            displayCoordinates(lat1, lon1, lat2, lon2, midLat, midLng);

            calculateTravelTime(lat1, lon1, midLat, midLng, "A");
            calculateTravelTime(lat2, lon2, midLat, midLng, "B");

            const prompt = document.getElementById("prompt").value;
            const data = {
                "prompt": prompt,
                "midLat": midLat,
                "midLng": midLng
            };
            console.log(data)

            return data;
        }
    );
};

const calculateTravelTime = (startLat, startLng, endLat, endLng, pointName) => {
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
        {
            origin: { lat: startLat, lng: startLng },
            destination: { lat: endLat, lng: endLng },
            travelMode: google.maps.TravelMode.WALKING,
        },
        (response, status) => {
            if (status === "OK") {
                const duration = response.routes[0].legs[0].duration.value;
                const formattedDuration = calculateTravelTimeInMin(duration);
                displayTravelTimes(pointName, formattedDuration);
            } else {
                document.getElementById("coordinates").innerHTML += `<p>Could not calculate travel time from Point ${pointName} to midpoint.</p>`;
            }
        }
    );
};

const calculateTravelTimeInMin = seconds => `${Math.floor(seconds/60)} min`;

const displayTravelTimes = (pointName, duration) => {
    const timeDiv = document.getElementById("time");
    timeDiv.innerHTML += `
    <p>Travel Time from ${pointName} to Midpoint: ${duration}</p>`;
}

const displayMarkers = (midLat, midLng) => {
    const midpointMarker = createMarkerElement("red", 15);
    markers.push(new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: { lat: midLat, lng: midLng },
        title: "Midpoint",
        content: midpointMarker,
    }));
};

const createMarkerElement = (color, size) => {
    const marker = document.createElement("div");
    marker.style.width = `${size}px`;
    marker.style.height = `${size}px`;
    marker.style.borderRadius = "50%";
    marker.style.backgroundColor = color;
    marker.style.border = "2px solid white";
    return marker;
};

const displayCoordinates = (lat1, lon1, lat2, lon2, midLat, midLng) => {
    const coordsDiv = document.getElementById("coordinates");
    coordsDiv.innerHTML = `
        <p>Person 1: (${lat1.toFixed(6)}, ${lon1.toFixed(6)})</p>
        <p>Person 2: (${lat2.toFixed(6)}, ${lon2.toFixed(6)})</p>
        <p>Midpoint (Route-Based): (${midLat.toFixed(6)}, ${midLng.toFixed(6)})</p>
    `;
};

const clearRouteAndMarkers = () => {
    if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer = null;
    }
    markers.forEach(marker => marker.setMap(null));
    markers = [];
};

initMap();