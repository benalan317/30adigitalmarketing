---
layout: page
title: "Book a Strategy Call"
seo_title: "Book a Free Strategy Call | 30A Digital Marketing"
description: "Book a free strategy call with 30A Digital Marketing, including an audit of how your business shows up in search today."
eyebrow: "Strategy Call"
lede: "A free call that includes an audit of how your business shows up in search today."
noindex: true
no_cta: true
sitemap: false
---
{% comment %}
PAGE BRIEF
Primary keyword: (conversion page)
Purpose: Destination for every call-to-action button. Booking method: Google Calendar booking page (embed code lives in _includes/booking-embed.html). Contact email: benalan317@gmail.com (interim; swap for hello@30adigitalmarketing.com when Google Workspace is set up).
{% endcomment %}
{%- capture booking_embed %}{% include booking-embed.html %}{% endcapture -%}
{%- assign booking_embed = booking_embed | strip -%}

## What happens on the call

We spend thirty minutes on your business. We look at how it shows up in search today, where customers are finding someone else instead, and which opportunities are worth pursuing first. There is no charge and no obligation.

## Choose a time

{% if booking_embed != "" -%}
Pick a time that suits you. You'll get a calendar invitation by email once you've booked.

<div class="booking-embed">
{{ booking_embed }}
</div>

Prefer to write first? Email [benalan317@gmail.com](mailto:benalan317@gmail.com).
{%- else -%}
Online booking is being set up. In the meantime, email [benalan317@gmail.com](mailto:benalan317@gmail.com) with your business name, your website and a couple of times that suit you, and we'll confirm a time.
{%- endif %}

## Before we talk

It helps to have your website address and a sense of what a new customer is worth to you. If you're not sure, we'll work it out together, or you can try the [ROI calculator](/roi-calculator/) first.
