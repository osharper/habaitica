import _ from 'lodash';
import moment from 'moment';
import { authWithHeaders } from '../../middlewares/auth';
import { Task } from '../../models/task';
import {
  NotFound,
  BadRequest,
} from '../../libs/errors';
import { scoreTasks } from '../../libs/tasks';
import { executeWebhook } from '../../libs/webhookUtils';

const api = {};

/**
 * @apiIgnore
 * @api {post} /api/v4/tasks/bulk-score Score multiple tasks
 * @apiName ScoreTasks
 * @apiGroup Task
 *
 * @apiParam (Body) {Object[]} body An array with the data on the tasks to score
 * @apiParam (Body) {String} body.*.id A task identifier, either the id or alias
 * @apiParam (Body) {String="up","down"} body.*.direction The direction in which to score the task
 *
 * @apiParamExample {json} Request-Example:
 * [{ "id": "a task id", "direction": "up" },
 * { "id": "a 2nd task id", "direction": "down" }]
 *
 * @apiSuccess {Object} data The user stats and a tasks object
 * @apiSuccess {Object[]} data.tasks An array of results with an object for each scored task
 * @apiSuccess {Object[]} data.tasks.*.id The id of the task scored
 * @apiSuccess {Object[]} data.tasks.*.delta The delta
 * @apiSuccess {Object[]} data.tasks.*._tmp If an item was dropped when scoring a task it'll
 * be returned in the _tmp object for that task
 *
 * @apiSuccess {Boolean} data.requiresApproval Approval was requested for team task
 * @apiSuccess {String} message Acknowledgment of team task approval request
 *
 * @apiSuccessExample {json} Example result:
 * {"success":true,"data":{"tasks": [{"id": "task id", "delta":0.9746999906450404,
 * "_tmp":{}],"hp":50,
 * "mp":37.2008917491047,"exp":101.93810026267543,"gp":77.09694176716997,
 * "lvl":19,"class":"rogue","points":0,"str":5,"con":3,"int":3,
 * "per":8,"buffs":{"str":9,"int":9,"per":9,"con":9,"stealth":0,"streaks":false,
 * "snowball":false,"spookySparkles":false,"shinySeed":false,"seafoam":false},
 * "training":{"int":0,"per":0,"str":0,"con":0}},"notifications":[]}
 *
 * @apiSuccessExample {json} Example result with item drop:
 * {"success":true,"data":{"tasks": [{"id": "task-id", delta":1.0259567046270648,
 * "_tmp":{"quest":{"progressDelta":1.2362778290756147,"collection":1},"drop":{"target":"Zombie",
 * "canDrop":true,"value":1,"key":"RottenMeat","type":"Food",
 * "dialog":"You've found Rotten Meat! Feed this to a pet and it may grow into a sturdy steed."}}],
 * "hp":50,"mp":66.2390716654227,"exp":143.93810026267545,"gp":135.12889840462591,"lvl":20,
 * "class":"rogue","points":0,"str":6,"con":3,"int":3,"per":8,"buffs":{"str":10,"int":10,"per":10,
 * "con":10,"stealth":0,"streaks":false,"snowball":false,"spookySparkles":false,
 * "shinySeed":false,"seafoam":false},"training":{"int":0,"per":0,"str":0,"con":0}},
 * "notifications":[]}
 *
 * @apiUse TaskNotFound
 */
api.scoreTasks = {
  method: 'POST',
  url: '/tasks/bulk-score',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    // Body is validated in scoreTasks

    const { user } = res.locals;
    const tasksResponses = await scoreTasks(user, req.body, req, res);

    const userStats = user.stats.toJSON();
    const resJsonData = _.assign({ tasks: tasksResponses }, userStats);
    res.respond(200, resJsonData);
  },
};

/**
 * @api {get} /api/v4/rewards/:rewardId/purchase-status Get reward purchase status
 * @apiName GetRewardPurchaseStatus
 * @apiGroup Task
 *
 * @apiParam (Path) {String} rewardId The reward identifier
 * @apiParam (Query) {String} [userId] User ID (defaults to authenticated user)
 *
 * @apiSuccess {Object} data Reward purchase status information
 * @apiSuccess {Object} data.reward Basic reward information
 * @apiSuccess {String} data.reward._id Reward ID
 * @apiSuccess {String} data.reward.text Reward name
 * @apiSuccess {Number} data.reward.value Reward cost
 * @apiSuccess {Date} data.lastPurchased Timestamp of last purchase
 * @apiSuccess {String} data.lastPurchasedBy User ID who last purchased
 * @apiSuccess {Boolean} data.purchasedToday Whether purchased today (respects dayStart)
 * @apiSuccess {Number} data.minutesSincePurchase Minutes since last purchase
 * @apiSuccess {Object} [data.actionConfig] Action configuration (if API polling enabled)
 * @apiSuccess {Number} [data.actionConfig.duration] Duration in minutes
 *
 * @apiUse TaskNotFound
 */
api.getRewardPurchaseStatus = {
  method: 'GET',
  url: '/rewards/:rewardId/purchase-status',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    const { rewardId } = req.params;
    const userIdParam = req.query.userId;
    const { user } = res.locals;

    // Validate rewardId
    if (!rewardId) {
      throw new BadRequest('Reward ID is required');
    }

    // Fetch the reward
    const reward = await Task.findOne({
      _id: rewardId,
      type: 'reward',
    }).exec();

    if (!reward) {
      throw new NotFound('Reward not found');
    }

    // Determine target user ID
    const targetUserId = user._id;
    if (userIdParam && userIdParam !== user._id) {
      // For now, only allow checking own purchases
      throw new BadRequest('Can only check own purchase status');
    }

    // Calculate purchasedToday based on user's dayStart
    let purchasedToday = false;
    let minutesSincePurchase = null;

    if (reward.lastPurchased && reward.lastPurchasedBy === targetUserId) {
      const now = moment().utcOffset(user.getUtcOffset());
      const lastPurchasedMoment = moment(reward.lastPurchased).utcOffset(user.getUtcOffset());

      // Calculate start of today based on user's custom day start
      const startOfToday = now.clone().startOf('day').add({
        hours: user.preferences.dayStart || 0,
      });

      // Check if last purchase was after start of today
      purchasedToday = lastPurchasedMoment.isAfter(startOfToday);

      // Calculate minutes since purchase
      minutesSincePurchase = now.diff(lastPurchasedMoment, 'minutes');
    }

    // Build response
    const responseData = {
      reward: {
        _id: reward._id,
        text: reward.text,
        value: reward.value,
      },
      lastPurchased: reward.lastPurchased || null,
      lastPurchasedBy: reward.lastPurchasedBy || null,
      purchasedToday,
      minutesSincePurchase,
    };

    // Include action config if API polling is enabled
    if (reward.actionEnabled && reward.actionConfig?.apiPolling?.enabled) {
      responseData.actionConfig = {
        duration: reward.actionConfig.clientAction?.duration || null,
      };
    }

    res.respond(200, responseData);
  },
};

/**
 * @api {post} /api/v4/rewards/:rewardId/test-webhook Test webhook configuration
 * @apiName TestRewardWebhook
 * @apiGroup Task
 *
 * @apiParam (Path) {String} rewardId The reward identifier
 * @apiParam (Body) {Object} webhook Webhook configuration to test
 * @apiParam (Body) {String} webhook.url Webhook URL
 * @apiParam (Body) {String="GET","POST","PUT"} [webhook.method=POST] HTTP method
 * @apiParam (Body) {Object} [webhook.headers] Request headers
 * @apiParam (Body) {Object} [webhook.body] Request body (for POST/PUT)
 * @apiParam (Body) {Number} [webhook.timeout=5000] Timeout in milliseconds
 *
 * @apiSuccess {Object} data Test result
 * @apiSuccess {Boolean} data.success Whether the webhook was executed successfully
 * @apiSuccess {Number} data.statusCode HTTP status code from webhook
 * @apiSuccess {String} [data.error] Error message if failed
 *
 * @apiUse TaskNotFound
 */
api.testRewardWebhook = {
  method: 'POST',
  url: '/rewards/:rewardId/test-webhook',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    const { rewardId } = req.params;
    const { webhook } = req.body;
    const { user } = res.locals;

    // Validate rewardId
    if (!rewardId) {
      throw new BadRequest('Reward ID is required');
    }

    // Validate webhook config
    if (!webhook || !webhook.url) {
      throw new BadRequest('Webhook configuration with URL is required');
    }

    // Fetch the reward to ensure it exists and belongs to the user
    const reward = await Task.findOne({
      _id: rewardId,
      type: 'reward',
      userId: user._id,
    }).exec();

    if (!reward) {
      throw new NotFound('Reward not found');
    }

    try {
      // Execute webhook with test context
      const result = await executeWebhook(webhook, {
        user,
        reward,
      });

      res.respond(200, result);
    } catch (error) {
      throw new BadRequest(`Webhook test failed: ${error.message}`);
    }
  },
};

export default api;
