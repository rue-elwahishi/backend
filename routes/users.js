const Router = (module.exports = require("express").Router());
const userController = require("../controllers/userController.js");
const Request = require("../models/request.js");
const Message = require("../models/message.js");
const User = require("../models/user.js");
const Friendship = require("../models/friendship.js");

const AUTH = require("passport").authenticate("jwt", { session: false });

Router.route("/")
  .get(userController.getUsers)
  .post(userController.signUp);

Router.route("/authenticate").post(userController.signIn);
Router.route("/:username").get(AUTH, (req, res) => {
  if (req.params.username == req.user.username)
    return res.json({ success: true, user: req.user });
  User.findOne({ username: req.params.username })
    .lean()
    .exec((err, found) => {
      if (!found)
        return res.json({ success: false, msg: "there's no such user" });
      Friendship.findOne(
        {
          $or: [
            { first: req.user._id, second: found._id },
            { first: found._id, second: req.user._id }
          ]
        },
        (err, friends) => {
          if (err) res.json({ success: false, err });
          else {
            if (friends) {
              found.areFriends = true;
              res.json({ success: true, user: found });
            } else {
              found.areFriends = false;
              Request.findOne(
                { sender: req.user._id, receiver: found._id },
                (err, request) => {
                  if (err) return res.json({ success: false, err });
                  if (request) {
                    found.sentRequest = true;
                    res.json({ success: true, user: found });
                  } else {
                    found.sentRequest = false;
                    Request.findOne(
                      { sender: found._id, receiver: req.user._id },
                      (err, gotrequest) => {
                        if (gotrequest) {
                          found.gotrequest = true;
                          res.json({ success: true, user: found });
                        } else {
                          found.gotrequest = false;
                          res.json({ success: true, user: found });
                        }
                      }
                    );
                  }
                }
              );
            }
          }
        }
      );
    });
});

Router.route("/:id/sendrequest").get(AUTH, userController.sendFriendRequest);
Router.route("/:id/removerequest").get(
  AUTH,
  userController.removeFriendRequest
);
Router.route("/:id/messages")
  .get(AUTH, (req, res) => {
    Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.id },
        { sender: req.params.id, receiver: req.user._id }
      ]
    })
      .populate("sender")
      .exec((err, messages) => {
        if (err) res.json({ success: false, err });
        else res.json(messages);
      });
  })
  .post(AUTH, (req, res) => {
    Message.create(
      {
        sender: req.user._id,
        receiver: req.params.id,
        content: req.body.content
      },
      (err, created) => {
        Message.findById(created._id).populate("sender").exec((err,found)=>{
          if (err) res.json({ success: false, err });
          else res.json(created);

        })
      }
    );
  });
Router.route("/:id/removefriend").get(AUTH, (req, res) => {
  const friend = req.params.id;
  Friendship.findOneAndDelete({
    $or: [
      { first: friend, second: req.user._id },
      { first: req.user._id, second: friend }
    ]
  }).then(data => {
    res.json({ success: true });
  });
});
Router.route("/:id/acceptrequest").get(AUTH, (req, res) => {
  const user = req.params.id;
  Friendship.create({ first: user, second: req.user._id }).then(data => {
    res.redirect(`/api/users/${user}/removerequest`);
  });
});
