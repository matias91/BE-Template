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
 * @returns a contract by id of the profile calling
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

/**
 * @returns a list of non terminated contracts belonging to a user
 */
app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const profileId = req.get('profile_id')
    const contracts = await Contract.findAll({
        where: { status: { [Sequelize.Op.not]: 'terminated' }, [Sequelize.Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    if (!contracts || !contracts.length) return res.status(404).end()
    res.json(contracts)
})

/**
 * @returns a list of unpaid jobs for a user
 */
app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { Contract, Job } = req.app.get('models')
    const profileId = req.get('profile_id')

    const contracts = await Contract.findAll({
        where: { status: { [Sequelize.Op.eq]: 'in_progress' }, [Sequelize.Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    const jobs = await Job.findAll({
        where: { paid: { [Sequelize.Op.not]: true }, ContractID: contracts.map((contract) => contract.id) },
    });

    // another option would be use "include",
    // but I didn't pick it because it add uneeded elements to the response
    //
    // const jobs = await Job.findAll({
    //     where: { paid: { [Sequelize.Op.not]: true } },
    //     include: {
    //         model: Contract,
    //         required: true,
    //         where: { status: { [Sequelize.Op.eq]: 'in_progress' }, [Sequelize.Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    //     }
    // });

    if (!jobs || !jobs.length) return res.status(404).end()
    res.json(jobs)
})

module.exports = app;
