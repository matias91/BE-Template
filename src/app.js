const express = require('express');
const bodyParser = require('body-parser');
const Sequelize = require('sequelize')
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * Returns the contract by id of the profile calling
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const { id } = req.params
    const profileId = req.get('profile_id')
    const contract = await Contract.findOne({
        where: { id, [Sequelize.Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    if (!contract) return res.status(404).end()
    res.json(contract)
})
module.exports = app;
