
async function getLastCellularConsumption(client, cosmosDatabaseName, cosmosContainerName, serviceRunDateTime) {
    let lastCellularUsage = [];
    lastCellularUsage.length = 0;
    try {
        const database = client.database(cosmosDatabaseName);
        //const container = database.container('HealthDashboardDev');
        const container = database.container(cosmosContainerName);

        // First Run
        // let today = new Date();
        // let previousMonthEndDate = new Date(today.getFullYear(), today.getMonth(), 0);
        // let dd = String(previousMonthEndDate.getDate()).padStart(2, '0');
        // let mm = String(previousMonthEndDate.getMonth()+1).padStart(2, '0'); // getMonth returns 0(Jan)-11(Dec)
        // let yyyy = previousMonthEndDate.getFullYear();
        // let endDay = yyyy + '-' + mm + '-' + dd;
        // let lastDocumentQuery = `Select Top 1 r.jobRunCounter, r.jobRunDateStamp from Root r Where r.jobRunDateStamp = "${endDay}" 
        // order by r.jobRunTimeStamp desc`;     
        //

        // Next Run
        // let today = new Date();
        // let dd = String(today.getDate()).padStart(2, '0');
        // let mm = String(today.getMonth() + 1).padStart(2, '0'); // getMonth returns 0-11,
        // let yyyy = today.getFullYear();
        // let todayDate = yyyy + '-' + mm + '-' + dd;
        let todayDate = serviceRunDateTime.todayDate;
        lastDocumentQuery = `Select Top 1 r.jobRunCounter, r.jobRunDateStamp from Root r Where r.jobRunDateStamp < "${todayDate}" order by r.jobRunTimeStamp desc`;     
        //

        let lastDocumentResult = await queryDocuments(lastDocumentQuery, container);
        if (lastDocumentResult !== undefined && lastDocumentResult.resources.length > 0) {
            let lastJobRunCounter = lastDocumentResult.resources[0].jobRunCounter;
            let lastjobRunDateStamp = lastDocumentResult.resources[0].jobRunDateStamp;
            if (lastJobRunCounter !== undefined) {
                let finalQuery = `Select r.mtag, r.jobRunCounter, r.cellularVom, r.cellularCustomer
                from Root r Where r.jobRunDateStamp = "${lastjobRunDateStamp}" and r.jobRunCounter = ${lastJobRunCounter}
                order by r.jobRunTimeStamp desc`;

                let result = await queryDocuments(finalQuery, container);
                if (result !== undefined && result.resources.length > 0) {
                    lastCellularUsage = result.resources;
                }
            }

        }

        if (lastCellularUsage.length == 0) {
            console.log(`Failed to get last cellular consumption`);
        }
        return lastCellularUsage;
    }
    catch (error) {
        console.log(error);
    }
}

const queryDocuments = (query, container) => {
    return new Promise((resolve, reject) => {
        //const client = getClient();      
        container.items.query(query).fetchAll()
            .then((result) => {
                resolve(result);
            })
            .catch((error) => {
                reject(error);
            });
    });
};

module.exports = {
    getLastCellularConsumption
}
