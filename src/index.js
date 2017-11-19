"use strict";

var request = require("request");

var AWS = require("aws-sdk");
var Alexa = require('alexa-sdk');

var GA_TRACKING_ID;

var dynamoDBTableName = 'expenses';

var speechOutput;
var reprompt;
var welcomeOutput = 'Welcome to Expense Tracker. What would you like to do today?';
var welcomeReprompt = 'Tell me what expense you would like to add';

var handlers = {
  'LaunchRequest': function() {
    this.response.speak(welcomeOutput).listen(welcomeReprompt);
    this.emit(':responseReady');
  },
  'AddNewExpenseIntent': function() {
    GA_TRACKING_ID = 'UA-109761792-1';
    var filledSlots = delegateSlotCollection.call(this);

    this.response.speak(speechOutput);
    this.emit(':responseReady');
  },
  'ReadExpensesByDateIntent': function() {
    var queryDate = this.event.request.intent.slots.ExpenseDate.value;
    var params = {
      TableName: dynamoDBTableName,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: {
          ":u": this.event.session.user.userId
      }
    };

    readExpenseByDate(params, myResult => {
      speechOutput = 'On ' + queryDate + ', you bought ';
      var listOfExpenses = [];
      myResult.forEach(function(item) {
        if (item.expenseDate === queryDate) {
          listOfExpenses.push(item.expenseDescription);
        }
      });
      if (listOfExpenses.length === 0) {
        speechOutput = "You didn't buy anything on " + queryDate;
      } else if (listOfExpenses.length === 1) {
        speechOutput += listOfExpenses[0];
      } else {
        listOfExpenses[listOfExpenses.length - 1] = 'and ' + listOfExpenses[listOfExpenses.length - 1];
        speechOutput += listOfExpenses.join(', ');
      }
      this.response.speak(speechOutput);
      this.emit(':responseReady');
    });

  },
  'AMAZON.HelpIntent': function () {
      speechOutput = "";
      reprompt = "";
      this.response.speak(speechOutput).listen(reprompt);
      this.emit(':responseReady');
  },
  'AMAZON.CancelIntent': function () {
      speechOutput = "";
      this.response.speak(speechOutput);
      this.emit(':responseReady');
  },
  'AMAZON.StopIntent': function () {
      speechOutput = "";
      this.response.speak(speechOutput);
      this.emit(':responseReady');
  }
};

exports.handler = function(event, context, callback){
  var alexa = Alexa.handler(event, context, callback);
  alexa.appId = 'amzn1.ask.skill.ca296ffb-c026-4a98-a361-a9ec51f499a4';
  alexa.registerHandlers(handlers);
  alexa.execute();
};

function delegateSlotCollection() {
  var userId = this.event.session.user.userId;
  console.log("in delegateSlotCollection");
  console.log("current dialogState: " + this.event.request.dialogState);

  if (this.event.request.dialogState === "STARTED") {
    console.log("in Beginning");
    var updatedIntent = this.event.request.intent;
    this.emit(":delegate", updatedIntent);
  } else if (this.event.request.dialogState !== "COMPLETED") {
    console.log("in not completed");
    this.emit(":delegate");
  } else {
    console.log("in completed");
    console.log("returning: " + JSON.stringify(this.event.request.intent));
    if (this.event.request.intent.confirmationStatus === 'CONFIRMED') {
      speechOutput = "Great! I've added the expense";
      var docClient = new AWS.DynamoDB.DocumentClient();
      var expenseDate = this.event.request.intent.slots.ExpenseDate.value;
      var expenseDescription = this.event.request.intent.slots.ExpenseDescription.value;
      var dollars = this.event.request.intent.slots.Dollars.value;
      var cents = this.event.request.intent.slots.Cents.value;
      var amount = parseInt(dollars) + parseInt(cents) / 100;

      var params = {
        TableName: dynamoDBTableName,
        Item: {
          "userId": userId,
          "timestamp": Date.now(),
          "expenseDate": expenseDate,
          "expenseDescription": expenseDescription,
          "amount": amount
        }
      };

      docClient.put(params, function(err, data) {
        if (err) {
          console.error("Unable to add expense. Error JSON:", JSON.stringify(err, null, 2));
        } else {
          console.log("Added expense:", JSON.stringify(data, null, 2));
        }
      });

      trackEvent(userId, 'Intent', 'AddNewExpenseIntent', 'Success', 1, function(err) {
        if (err) {
          console.log(next(err));
        }
        console.log('Tracking works!');
      });

    } else if (this.event.request.intent.confirmationStatus === 'DENIED'){
      speechOutput = "Ok. I've cancelled the expense";
      trackEvent(userId,'Intent', 'AddNewExpenseIntent', 'Fail', 1, function(err) {
        if (err) {
          console.log(next(err));
        }
        console.log('Tracking works!');
      });
    }
    return this.event.request.intent;
  }
}

function readExpenseByDate(params, callback) {

  var docClient = new AWS.DynamoDB.DocumentClient();
  console.log("Querying for expenses");

  docClient.query(params, function(err, data) {
    if (err) {
      console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
      console.log("Query succeeded. Data: ", data);
      callback(data.Items);
    }
  });
}

function trackEvent(userId, category, action, label, value, callback) {
  var data = {
    v: '1',
    tid: GA_TRACKING_ID,
    cid: userId,
    t: 'event',
    ec: category,
    ea: action,
    el: label,
    ev: value,
  };

  request.post(
    'http://www.google-analytics.com/collect', {
      form: data
    },
    function(err, response) {
      if (err) { return callback(err); }
      if (response.statusCode !== 200) {
        return callback(new Error('Tracking failed'));
      }
      callback();
    }
  );
}
