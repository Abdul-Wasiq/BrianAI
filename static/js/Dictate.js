class Dictate {
    constructor() {
        console.log("Dictate Module is working")
        this.isListening = false
    }

    testConnection() {
        console.log("Dictate.testConnection() was called! Everything is linked up.");
        return "This text came from the Dictate module!";
    }
}
export default Dictate