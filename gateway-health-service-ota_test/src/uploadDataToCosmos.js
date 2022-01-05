//const cosmos = require("@azure/cosmos");

upsertDocument = (finalTemplate, client, databaseId, containerId) => {
    return new Promise((resolve, reject) => { 
        let today = new Date();
        let timestamp = today.toISOString();

        finalTemplate.documentCreatedTimeStamp = timestamp;

        const database = client.database(databaseId);
        const container = database.container(containerId);
        container.items.upsert(finalTemplate)
        .then((result) => {
            resolve(result);
        })
        .catch((error) => {
            reject(error);
        });
    });
};



module.exports = {
    upsertDocument
}
