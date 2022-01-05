//const pgClient  = require('pg').Client;
const { date } = require('azure-storage');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

// const postgresConfig = {
//     host: 'msgiot-platform-dev.postgres.database.azure.com',
//     user: 'parkeradmin@msgiot-platform-dev',
//     password: 'Parker@2020',
//     database: 'postgres',
//     port: 5432,
//     ssl: true
// };


// uploadDataToPostgres = async (deviceId, newTemplate) => {

//     //const clientResult = await PostgresConnection(null,config);
//     var pgData;

//     const pgClient = new Client(postgresConfig);

//     await pgClient
//         .connect()
//         .then(() => console.log('connected'))
//         .catch(err => console.log('connection error', err.stack))

//     await pgClient
//         .query('SELECT * FROM public.firmware')
//         .then(result => pgData = result.rows)
//         .catch(e => console.error(e.stack))
//         .then(() => pgClient.end())

//     return pgData;

// }

async function uploadDataToPostgres(deviceId, newTemplate, config) {

    const firmUId = uuidv4();
    let updatedAt = newTemplate.gwDeviceTwin.lastActivityTime;
    let isActive = newTemplate.platform.state.toLowerCase() == 'active' ? true : false;
    let jobStatus = newTemplate.gwDeviceTwin.jobs.job1.jobStatus;
    var isDeleted = false;
    var category = '';
    var uploadedBy = '';
    var description = '';
    var fwLocation;
    var query;

    try {
        //var sVersions = Object.entries(newTemplate.gwDeviceTwin.softwareVersions);
        var sVersions = newTemplate.gwDeviceTwin.softwareVersions;
        for (let key in sVersions) {
            let firmName = key.toLowerCase().replace('-', '_');
            let firmVersion = sVersions[key];
            query = "SELECT * FROM public.firmware WHERE version_number = '" + firmVersion + "' and firmware_name='" + firmName + "'";

            let pgRows = await PostgresConnection(query, config);

            var dbFirmid;
            var dbFirmVersion;
            var dbFirmName;
            var dbUploadedAt;

            if (pgRows.rows != null && pgRows.rows.length > 0) {

                dbFirmid = pgRows.rows[0].id; //correct firmware_id  myString.slice(0, -1)
                dbFirmVersion = pgRows.rows[0].version_number;
                dbFirmName = pgRows.rows[0].firmware_name;
                dbUploadedAt = pgRows.rows[0].uploaded_at;

                let uploadedAt= new Date(dbUploadedAt);
                uploadedAt = uploadedAt.toLocaleDateString() + " " + uploadedAt.toLocaleTimeString();

                if (firmVersion != undefined) {
                    await UpdateGatewayVersion(deviceId, config, dbFirmid, dbFirmName, uploadedAt);
                }
            }
            else {

                query = "INSERT INTO public.firmware(id, firmware_name,version_number,category,firmware_desc, isactive, deleted, status, uploaded_at, uploaded_by, fw_location_url)" +
                    "VALUES ('" + firmUId + "', '" + firmName + "','" + firmVersion + "','" + category + "','" + description + "'," + isActive + "," + isDeleted + ",'" + jobStatus + "','" + uploadedAt + "','" + uploadedBy + "','" + fwLocation + "')";

                query = query.replace("''", null);
                let result = await PostgresConnection(query, config);
            }
            console.log("Gateway Firmware History table updated successfully...");
        }
    }
    catch (error) {
        console.log(error.message)
    }

}

async function PostgresConnection(query, config) {
    var pgData;
    try {
        //const query = "SELECT * FROM public.firmware";
        //const query=`SELECT * FROM public.firmware WHERE version_number = 'v1.2.4' and firmware_name='hed_led'`;
        const client = new Client(config);
        await client.connect();
        pgData = await client.query(query);
        await client.end();
        //client.end();
    }
    catch (error) {
        console.log(error.message);
    }
    return pgData;
}

async function UpdateGatewayVersion(deviceId, config, dbFirmid, firmName, uploadedAt) {
    const gvUId = uuidv4();
    query = "SELECT * FROM public.gateway_versions where firmware_name='" + firmName + "'";
    let gvData = await PostgresConnection(query, config);
    if (gvData != undefined && gvData?.length > 0 && uploadedAt !=gvData.rows[0].updated_at && gvData.rows[0].mtag==deviceId) {
        query = "UPDATE public.gateway_versions SET firmware_id='" + dbFirmid + "', updated_at='" + uploadedAt + "' WHERE firmware_name='" + firmName + "'";
    }
    else {
        query = "INSERT INTO public.gateway_versions (id, firmware_id,firmware_name,updated_at,mtag) VALUES ('" + gvUId + "','" + dbFirmid + "','" + firmName + "','" + uploadedAt + "','" + deviceId + "')";
    }
    await PostgresConnection(query, config);
}

module.exports = {
    uploadDataToPostgres
}

