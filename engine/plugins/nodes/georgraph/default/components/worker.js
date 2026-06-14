self.onmessage = async (e) => {
    try {
        const response = await fetch(e.data.url);
        const text = await response.text();

        // heavy parse background thread-ზე
        const geoJson = JSON.parse(text);

        self.postMessage({
            success: true,
            data: geoJson
        });

    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message
        });
    }
};