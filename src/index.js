"use strict";

var AWS = require("aws-sdk");
var Alexa = require('alexa-sdk');

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
    var filledSlots = delegateSlotCollection.call(this);

    this.response.speak(speechOutput);
    this.emit(':responseReady');
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
          "userId": this.event.session.user.userId,
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
    } else if (this.event.request.intent.confirmationStatus === 'DENIED'){
      speechOutput = "Ok. I've cancelled the expense";
    }
    return this.event.request.intent;
  }
}
