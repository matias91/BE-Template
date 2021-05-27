const express = require('express');
const bodyParser = require('body-parser');
const { Op } = require('sequelize')
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
        where: { id, [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
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
        where: { status: { [Op.not]: 'terminated' }, [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
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
        where: { status: { [Op.eq]: 'in_progress' }, [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    });

    const jobs = await Job.findAll({
        where: { paid: { [Op.not]: true }, ContractID: contracts.map((contract) => contract.id) },
    });

    // another option would be use "include",
    // but I didn't pick it because it add uneeded elements to the response
    //
    // const jobs = await Job.findAll({
    //     where: { paid: { [Op.not]: true } },
    //     include: {
    //         model: Contract,
    //         required: true,
    //         where: { status: { [Op.eq]: 'in_progress' }, [Op.or]: [{ ContractorId: profileId }, { ClientId: profileId }] }
    //     }
    // });

    if (!jobs || !jobs.length) return res.status(404).end()
    res.json(jobs)
})

/**
 * @returns a paid job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { Contract, Profile, Job } = req.app.get('models')
    const { job_id: jobId } = req.params
    const { balance, id: profileId, type } = req.profile

    if (type !== 'client') return res.json({ success: false, error: 'Invalid profile type' })

    const job = await Job.findOne({
        where: { id: jobId, paid: { [Op.not]: true } },
        include: [{
            model: Contract,
            required: true,
            where: {
                [Op.or]: [{ ClientId: profileId }, { ContractorId: profileId }],
            },
        }]
    });

    if (!job) return res.json({ success: false, error: 'Job not found' })

    if (job.price > balance) return res.json({ success: false, error: 'Insufficient funds' })

    const transaction = await sequelize.transaction()
    try {
        await Profile.increment('balance', {
            by: job.price,
            where: { id: job.Contract.ContractorId },
            transaction,
        })
        await Profile.decrement('balance', {
            by: job.price,
            where: { id: job.Contract.ClientId },
            transaction,
        })

        job.paid = true
        job.paymentDate = new Date()
        job.save()

        await transaction.commit()

        res.json({ job })
    } catch (error) {
        await transaction.rollback()

        res.json({ success: false, error })
    }
})

module.exports = app;
