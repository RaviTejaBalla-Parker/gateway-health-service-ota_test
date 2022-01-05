var azure = require('azure-storage');

getPartNumberMetaData = (partNumberStorageAccountName,partNumberStorageAccountKey) => {
    console.log("getPartNumberMetaData");
    let partNumberMetaData = [];
    partNumberMetaData.length = 0;
    const tableService = azure.createTableService(partNumberStorageAccountName, partNumberStorageAccountKey)
    
    let query = new azure.TableQuery()
        .select(['PartNumber', 'CellTech', 'ContractLengthMonths', 'CustomerRatePlanMB', 'Description','Region']);

    return new Promise((resolve, reject) => {
        tableService.queryEntities(`partNumberMetaDataTable`, query, null, function (error, result, response) {
            if (!error) {
                if (result.entries.length > 0)
                    partNumberMetaData = response.body.value;                    
                    //console.log(`partNumberMetaData length:${partNumberMetaData.length}`);
                    return resolve(partNumberMetaData);
            }
            else {
                console.log(`Failed to get part number meta data`);
                return reject(error);
            }
        });
    });
}

module.exports = {
    getPartNumberMetaData
}
